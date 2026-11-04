// Read-only check of the free rules against real mail.
// Compares the rules' answer with mail whose pile was set by the AI or by the user.
//   npx tsx --conditions=react-server --env-file=.env.local scripts/eval.ts
import { db } from "../src/lib/supabase";
import { getAccessToken, getMessage } from "../src/lib/gmail";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";

async function main() {
  const { data: users } = await db.from("users").select("*");
  for (const user of users ?? []) {
    const profile = profileFromName(user.name);
    const token = await getAccessToken(user.refresh_token);
    const { data: rows } = await db
      .from("emails")
      .select("id, subject, priority, category, sorted_by, user_corrected")
      .eq("user_email", user.email)
      .or("sorted_by.eq.ai,user_corrected.eq.true");
    let agree = 0, total = 0;
    const misses: string[] = [];
    for (let i = 0; i < (rows ?? []).length; i += 3) {
      await Promise.all(
        rows!.slice(i, i + 3).map(async (r) => {
          try {
            const msg = await getMessage(token, r.id);
            const got = classifyByRules(msg, [], profile);
            total++;
            if (got.priority === r.priority) agree++;
            else misses.push(`${r.user_corrected ? "YOU" : "AI "} ${r.priority.padEnd(14)} rules:${got.priority.padEnd(14)} ${r.subject?.slice(0, 64)}`);
          } catch {}
        }),
      );
    }
    console.log(`${user.email.replace(/^(.{3}).*@/, "$1…@")}: rules agree on ${agree}/${total} (${total ? Math.round((agree / total) * 100) : 0}%)`);
    misses.forEach((x) => console.log("  ", x));
  }
}
main();
