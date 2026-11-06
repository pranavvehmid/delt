// #24: the sorter measured on shared, anonymised labelled sets:
//   tests/fixtures/labelled.json: the first set
//   tests/fixtures/heldout.json: written later without looking at the rules (it started at 78%, Urgent recall 59%)
// Prints agreement and per-pile precision/recall in CI, and fails if a change makes them worse.
// Missing Urgent mail is worse than over-flagging, so Urgent recall has its own floor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";
import type { Priority } from "../src/lib/supabase";

const NOW = Date.parse("2026-11-05T10:00:00+05:30");
const ME = profileFromName("A B STUDENT NAME 26BCE0001", new Date(NOW));
type Mail = { s: string; b: string; f: string; p: Priority };
const load = (name: string) => (JSON.parse(readFileSync(`tests/fixtures/${name}.json`, "utf8")) as { mails: Mail[] }).mails;
const SETS = { labelled: load("labelled"), heldout: load("heldout") };
const PILES: Priority[] = ["very_important", "priority", "later", "noise"];

// Raise these when the sorter gets better; never lower them to make a change pass.
const FLOOR = { agreement: 0.9, urgentRecall: 0.95 };

export function evaluate(mails: Mail[] = SETS.labelled) {
  const rows = mails.map((x, i) => {
    const got = classifyByRules(
      { id: `e${i}`, threadId: `e${i}`, fromName: "S", fromAddress: x.f, subject: x.s, snippet: "", receivedAt: new Date(NOW - 3600_000), body: x.b, unread: true },
      [],
      ME,
      NOW,
    ).priority;
    return { ...x, got };
  });
  const per = Object.fromEntries(
    PILES.map((p) => {
      const tp = rows.filter((r) => r.got === p && r.p === p).length;
      const predicted = rows.filter((r) => r.got === p).length;
      const actual = rows.filter((r) => r.p === p).length;
      return [p, { precision: predicted ? tp / predicted : 1, recall: actual ? tp / actual : 1, n: actual }];
    }),
  ) as Record<Priority, { precision: number; recall: number; n: number }>;
  const agreement = rows.filter((r) => r.got === r.p).length / rows.length;
  return { rows, per, agreement };
}

for (const [name, mails] of Object.entries(SETS)) test(`the sorter on the ${name} set: agreement and per-pile scores`, () => {
  const { rows, per, agreement } = evaluate(mails);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.log(`\n${name}: ${rows.length} mails, agreement ${pct(agreement)}`);
  for (const p of PILES) console.log(`  ${p.padEnd(15)} precision ${pct(per[p].precision).padStart(4)}  recall ${pct(per[p].recall).padStart(4)}  (${per[p].n})`);
  const wrong = rows.filter((r) => r.got !== r.p);
  if (wrong.length) console.log("  wrong:\n" + wrong.map((r) => `    ${r.p} -> ${r.got}: ${r.s}`).join("\n"));
  assert.ok(agreement >= FLOOR.agreement, `agreement ${pct(agreement)} < ${pct(FLOOR.agreement)}`);
  assert.ok(per.very_important.recall >= FLOOR.urgentRecall, `Urgent recall ${pct(per.very_important.recall)} < ${pct(FLOOR.urgentRecall)}`);
});

test("the labelled sets stay anonymous", () => {
  for (const m of [...SETS.labelled, ...SETS.heldout]) {
    assert.doesNotMatch(`${m.s} ${m.b}`, /\b\d{2}[A-Z]{3}\d{4}\b/, "no register numbers");
    assert.doesNotMatch(m.f, /^[a-z]+\.[a-z]+\d{4}@vitstudent\.ac\.in$/, "no personal student addresses");
  }
});
