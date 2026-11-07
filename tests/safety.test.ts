// Every student must only ever see and change their own mail.
// These checks read the API source so a future edit can't quietly drop the guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}
const API = files("src/app/api").filter((f) => !f.includes("[...nextauth]"));

test("every API route checks who is signed in (or the cron secret)", () => {
  assert.ok(API.length >= 4);
  for (const f of API) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/export async function (GET|POST|PATCH|DELETE|PUT)\b[\s\S]*?\n}/g)) {
      const body = m[0];
      assert.ok(/await auth\(\)|currentUser\(\)|CRON_SECRET/.test(body), `${f} ${m[1]} has no sign-in check`);
    }
  }
});

test("every query on the emails table is limited to the signed-in student", () => {
  for (const f of API) {
    const src = readFileSync(f, "utf8");
    // each statement that touches the emails table
    for (const stmt of src.split(/;\s*\n/).filter((s) => s.includes('from("emails")'))) {
      assert.match(stmt, /\.eq\("user_email", email\)/, `${f}: emails query without user_email filter:\n${stmt.trim().slice(0, 200)}`);
    }
  }
});

test("the user's own Gmail token is looked up by their own email only", () => {
  for (const f of API) {
    const src = readFileSync(f, "utf8");
    for (const stmt of src.split(/;\s*\n/).filter((s) => s.includes('from("users")') && s.includes("refresh_token") && !f.includes("sync"))) {
      assert.match(stmt, /\.eq\("email", email\)/, `${f}: token lookup not tied to the signed-in user`);
    }
  }
});

test("sync and maintenance scripts only touch the student's own rows", () => {
  for (const f of ["src/lib/sync.ts", "scripts/resort.ts", "scripts/eval.ts"]) {
    const src = readFileSync(f, "utf8");
    for (const stmt of src.split(/;\s*\n/).filter((s) => /\.from\("emails"\)|from\("emails"\)/.test(s))) {
      assert.match(stmt, /user_email/, `${f}: emails statement without user_email:\n${stmt.trim().slice(0, 200)}`);
    }
  }
  // saving uses the per-student key, so two students can never overwrite each other
  assert.match(readFileSync("src/lib/sync.ts", "utf8"), /onConflict: "user_email,id"/);
  assert.match(readFileSync("supabase/schema.sql", "utf8"), /primary key \(user_email, id\)/);
});

test("sign-in is open to every VIT student domain, nobody else", () => {
  const src = readFileSync("src/auth.ts", "utf8");
  assert.match(src, /vitstudent\.ac\.in/);
  assert.match(src, /allowedDomains\.includes\(domain\)/);
  // no personal address hard-coded anywhere in the app
  for (const f of [...files("src"), ...files("tests")]) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /@gmail\.com/i, `${f} mentions a personal Gmail address`);
    assert.doesNotMatch(text, /\b2[0-9][A-Z]{3}0387\b/, `${f} has a real register number`);
  }
});

test("#91: id lists from a request are sent to the database in chunks, never all in one URL", () => {
  const src = readFileSync("src/app/api/emails/bulk/route.ts", "utf8");
  assert.doesNotMatch(src, /\.in\("id", (ids|mine)\)/);
  assert.match(src, /const ID_CHUNK = 200/);
});

test("#110: a bulk move is marked labelled only after Gmail confirms, so sync retries failures", () => {
  const src = readFileSync("src/app/api/emails/bulk/route.ts", "utf8");
  assert.match(src, /user_corrected: true, gmail_labeled: false/);
  assert.ok(src.indexOf("batchModify(token, mine, [labels[priority]]") < src.indexOf("update({ gmail_labeled: true })"));
});

test("#112: changing a mail that isn't there answers 404, not OK", () => {
  const src = readFileSync("src/app/api/emails/route.ts", "utf8");
  assert.match(src, /\.eq\("user_email", email\)\.select\("id"\)/);
  assert.match(src, /status: 404/);
});

test("#228: a crash shows DELT's error screen, not a blank page", () => {
  const src = readFileSync("src/app/error.tsx", "utf8");
  assert.match(src, /^"use client"/);
  assert.match(src, /reset\(\)/);
});

test("#111: a pile move is 'not yet in Gmail' until Gmail confirms; Gmail failures are reported", () => {
  const src = readFileSync("src/app/api/emails/route.ts", "utf8");
  assert.match(src, /user_corrected: true, gmail_labeled: false/);
  assert.match(src, /update\(\{ gmail_labeled: true \}\)/);
  assert.match(src, /NextResponse\.json\(\{ ok: true, gmail \}\)/);
});

test("#113: deadlines more than two years away are refused", () => {
  assert.match(readFileSync("src/app/api/emails/route.ts", "utf8"), /Math\.abs\(Date\.parse\(d\) - Date\.now\(\)\) < 2 \* 366 \* 86400_000/);
});

test("#132: the 'Notifications are on' message goes only to a newly added device", () => {
  const src = readFileSync("src/app/api/push/route.ts", "utf8");
  assert.ok(src.indexOf('select("endpoint").eq("endpoint", endpoint)') < src.indexOf(".upsert("), "checks before saving");
  assert.match(src, /if \(!had\) await sendToStudent/);
});

test("#133: routes a student calls never send raw database or Google errors to the browser", () => {
  for (const f of API.filter((f) => !/health/.test(f))) {
    const src = readFileSync(f, "utf8");
    // the background-sync GET (cron secret only) may report details; everything students call may not
    const studentPart = f.includes("api/sync") ? src.slice(0, src.indexOf("export async function GET")) : src;
    assert.doesNotMatch(studentPart, /error: (error\.message|\(e as Error\)\.message)/, f);
  }
});
