// Re-sorts mail already in the database with the current rules (and free AI).
// Run after changing the sorting rules:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/resort.ts [email] [--apply] [--ai=40] [--rules-only]
// Without --apply it only prints what would change. Mails you moved by hand are never touched.
import { db } from "../src/lib/supabase";
import { getAccessToken, getMessage, type ParsedMessage } from "../src/lib/gmail";
import { classifyByRules } from "../src/lib/rules";
import { aiEnabled, classifyWithAI, QuotaExhausted } from "../src/lib/classify";
import { profileFromName } from "../src/lib/profile";
import type { Classification } from "../src/lib/types";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const aiMax = Number(args.find((a) => a.startsWith("--ai="))?.split("=")[1] ?? 0);
const only = args.find((a) => a.includes("@"));
// --rules-only: leave mail the AI already sorted alone (it is usually better on unclear mail).
const rulesOnly = args.includes("--rules-only");
const RANK = { very_important: 0, priority: 1, later: 2, noise: 3 } as const;
const short = { very_important: "VERY", priority: "prio", later: "late", noise: "nois" } as const;

async function main() {
  let q = db.from("users").select("*");
  if (only) q = q.eq("email", only);
  const { data: users } = await q;
  for (const user of users ?? []) {
    const profile = profileFromName(user.name);
    console.log(`\n== ${user.email} (${profile.regNo ?? "no reg no"}, year ${profile.year ?? "?"})`);
    const token = await getAccessToken(user.refresh_token);
    let rq = db
      .from("emails")
      .select("id, priority, subject")
      .eq("user_email", user.email)
      .eq("user_corrected", false)
      .neq("sorted_by", "manual"); // moved by hand without a rule (#46)
    if (rulesOnly) rq = rq.eq("sorted_by", "rules");
    const { data: rows } = await rq.order("received_at", { ascending: false });

    const items: { id: string; old: string; msg: ParsedMessage; c: Classification; conf: number; ai: boolean }[] = [];
    for (let i = 0; i < (rows ?? []).length; i += 3) {
      await Promise.all(
        rows!.slice(i, i + 3).map(async (r) => {
          try {
            const msg = await getMessage(token, r.id);
            const { confidence, ...c } = classifyByRules(msg, [], profile);
            items.push({ id: r.id, old: r.priority, msg, c, conf: confidence, ai: false });
          } catch (e) {
            console.log("skip", r.id, (e as Error).message.slice(0, 80));
          }
        }),
      );
    }

    if (aiMax > 0 && aiEnabled()) {
      const todo = items
        .filter((x) => x.conf < 0.95 && (x.conf < 0.6 || RANK[x.c.priority] <= 1))
        .sort((a, b) => RANK[a.c.priority] - RANK[b.c.priority] || b.msg.receivedAt.getTime() - a.msg.receivedAt.getTime())
        .slice(0, aiMax);
      console.log(`Asking free AI about ${todo.length} mails (about ${Math.round(todo.length * 4.5)}s)…`);
      for (const x of todo) {
        try {
          x.c = await classifyWithAI(x.msg, [], profile);
          x.ai = true;
        } catch (e) {
          if (e instanceof QuotaExhausted) {
            console.log("Free AI limit reached; keeping rules for the rest.");
            break;
          }
          console.log("AI error", (e as Error).message.slice(0, 100));
        }
        await new Promise((r) => setTimeout(r, 4500));
      }
    }

    items.sort((a, b) => RANK[a.c.priority] - RANK[b.c.priority]);
    for (const x of items) {
      const mark = x.old === x.c.priority ? "  " : "->";
      console.log(
        `${short[x.old as keyof typeof short]} ${mark} ${short[x.c.priority]} ${x.ai ? "AI" : "  "} ${x.c.category.padEnd(12)} ${(x.c.deadline ?? "").slice(0, 10).padEnd(10)} ${x.msg.subject.slice(0, 70)} | ${x.c.reason}`,
      );
    }
    const counts = items.reduce<Record<string, number>>((a, x) => ((a[x.c.priority] = (a[x.c.priority] ?? 0) + 1), a), {});
    console.log("New totals:", counts);

    if (apply) {
      for (const x of items) {
        await db
          .from("emails")
          .update({
            ...x.c,
            sorted_by: x.ai ? "ai" : "rules",
            ...(x.old !== x.c.priority ? { gmail_labeled: false } : {}),
          })
          .eq("id", x.id)
          .eq("user_email", user.email);
      }
      console.log(`Saved ${items.length} mails.`);
    }
  }
}

main();
