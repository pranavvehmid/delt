// Issue #30: one student can't use up DELT's free allowances for everyone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { allow, limited, resetLimits } from "../src/lib/rate-limit";

test("a student gets their allowance per minute, then a wait, then a fresh minute", () => {
  resetLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(allow("x:a", 5, 60_000, t0 + i).ok, true);
  const over = allow("x:a", 5, 60_000, t0 + 10_000);
  assert.equal(over.ok, false);
  assert.equal(over.retryAfter, 50);
  assert.equal(allow("x:a", 5, 60_000, t0 + 60_001).ok, true, "new window");
});

test("students and routes have separate allowances", () => {
  resetLimits();
  for (let i = 0; i < 5; i++) allow("x:a", 5);
  assert.equal(allow("x:a", 5).ok, false);
  assert.equal(allow("x:b", 5).ok, true, "another student");
  assert.equal(allow("y:a", 5).ok, true, "another route");
});

test("the 429 answer says when to try again", async () => {
  resetLimits();
  let last: Response | null = null;
  for (let i = 0; i < 6; i++) last = limited("s@vitstudent.ac.in", "account");
  assert.ok(last);
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("Retry-After")) > 0);
  assert.match((await last.json()).error, /Too many/);
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f === "route.ts" ? [join(dir, f)] : []));
}
test("every signed-in API handler is rate limited (sync uses the database claim instead)", () => {
  // app-version is public and answered from Vercel's cache (#98)
  for (const f of files("src/app/api").filter((f) => !f.includes("nextauth") && !/app-version/.test(f))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/export async function (GET|POST|PATCH|DELETE)\b[\s\S]*?\n}/g)) {
      if (/CRON_SECRET/.test(m[0])) continue;
      assert.ok(/limited\(email|claimSync\(email/.test(m[0]), `${f} ${m[1]} has no rate limit`);
    }
  }
});
