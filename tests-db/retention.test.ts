// #90, #125: the purge against a real Postgres. Old unmoved mail goes, in batches; moved mail and
// recent mail stay; another student's rows with the same Gmail id are untouched.
// Run: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const skip = !url || !key ? "needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" : false;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

const A = "purge.a2026@vitstudent.ac.in";
const B = "purge.b2026@vitstudent.ac.in";
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const row = (user: string, id: string, days: number, corrected = false) => ({
  id, user_email: user, from_name: "Office", from_address: "office@vit.ac.in", subject: `Mail ${id}`, snippet: "", received_at: daysAgo(days),
  priority: "later", category: "other", summary: "", deadline: null, user_corrected: corrected, unread: false,
});

before(async () => {
  if (skip) return;
  for (const u of [A, B]) {
    await sb!.from("users").delete().eq("email", u);
    await sb!.from("users").insert({ email: u, refresh_token: "v1.x.y.z" });
  }
  // A: 450 old (more than two batches), 2 old but moved, 3 recent. B: one recent mail sharing an old id of A's.
  const old = Array.from({ length: 450 }, (_, i) => row(A, `old${i}`, 200));
  await sb!.from("emails").insert(old);
  await sb!.from("emails").insert([row(A, "kept1", 200, true), row(A, "kept2", 300, true), row(A, "new1", 10), row(A, "new2", 1), row(A, "new3", 179), row(B, "old0", 5)]);
});

after(async () => {
  if (skip) return;
  for (const u of [A, B]) await sb!.from("users").delete().eq("email", u);
});

test("old unmoved mail is deleted in batches; moved, recent and other students' mail stays", { skip }, async () => {
  const { purgeOldMail } = await import("../src/lib/retention");
  const gone = await purgeOldMail();
  assert.ok(gone >= 450, `deleted ${gone}`);
  const { data: a } = await sb!.from("emails").select("id").eq("user_email", A).order("id");
  assert.deepEqual(a!.map((r) => r.id), ["kept1", "kept2", "new1", "new2", "new3"]);
  const { data: b } = await sb!.from("emails").select("id").eq("user_email", B);
  assert.deepEqual(b!.map((r) => r.id), ["old0"]);
});

test("the purge runs at most once a day", { skip }, async () => {
  const { purgeIfDue } = await import("../src/lib/retention");
  await sb!.from("app_state").delete().eq("key", "last_purge");
  await purgeIfDue();
  const { data } = await sb!.from("app_state").select("value").eq("key", "last_purge").single();
  assert.ok((data!.value as { at: number }).at > Date.now() - 60_000);
  await sb!.from("emails").insert(row(A, "late-old", 400));
  assert.equal(await purgeIfDue(), 0, "not again within the day");
  const { data: still } = await sb!.from("emails").select("id").eq("id", "late-old");
  assert.equal(still!.length, 1);
});
