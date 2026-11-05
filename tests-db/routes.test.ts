// #39: the API routes against a real Postgres (Supabase run locally in CI, with supabase/schema.sql
// applied). Two students, A and B. B calls every route with A's ids and must never see or change
// A's rows. Sign-in and Gmail are replaced; the database is real.
// Run: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run test:db
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const skip = !url || !key ? "needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (CI runs it against a local Supabase)" : false;
process.env.AUTH_SECRET ??= "test-secret-for-route-tests-only-0123456789";

const A = "student.a2026@vitstudent.ac.in";
const B = "student.b2026@vitstudent.ac.in";
let who = B;
const src = (p: string) => pathToFileURL(path.resolve("src", p)).href;

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
let routes: Record<string, Record<string, Handler>> = {};
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

const now = Date.now();
const iso = (h: number) => new Date(now + h * 3600_000).toISOString();
const mail = (user: string, id: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_email: user,
  from_name: "Office of DSW",
  from_address: `dsw@${user === A ? "a" : "b"}.vit.ac.in`,
  subject: `Hostel fee ${id}`,
  snippet: "Pay by tomorrow",
  received_at: iso(-1),
  priority: "very_important",
  category: "fees",
  summary: "Pay the fee",
  ...extra,
});

async function snapshot(user: string) {
  const [e, u, p] = await Promise.all([
    sb!.from("emails").select("*").eq("user_email", user).order("id"),
    sb!.from("users").select("*").eq("email", user),
    sb!.from("push_subscriptions").select("*").eq("user_email", user).order("endpoint"),
  ]);
  return JSON.stringify([e.data, u.data, p.data]);
}

async function call(route: string, method: string, opts: { query?: string; body?: unknown; id?: string } = {}) {
  const req = new NextRequest(`http://localhost/api/${route}${opts.query ?? ""}`, {
    method,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body), headers: { "content-type": "application/json" } } : {}),
  });
  const ctx = opts.id ? { params: Promise.resolve({ id: opts.id }) } : undefined;
  const res = await routes[route][method](req, ctx);
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  if (skip) return;
  // sign-in: whoever `who` is
  mock.module(src("auth.ts"), {
    namedExports: { auth: async () => ({ user: { email: who } }), signOut: async () => {}, signIn: async () => {}, handlers: {} },
  });
  // Gmail: never called for real
  const real = await import(src("lib/gmail.ts"));
  mock.module(src("lib/gmail.ts"), {
    namedExports: {
      ...real,
      getAccessToken: async () => "token",
      ensureLabels: async () => ({ very_important: "L1", priority: "L2", later: "L3", noise: "L4" }),
      setPriorityLabel: async () => {},
      markRead: async () => {},
      markUnread: async () => {},
      batchModify: async () => {},
      getFullMessage: async (_t: string, id: string) => ({ id, from: "Office of DSW", subject: "x", html: null, text: "hi", attachments: [] }),
      removeDeltLabels: async () => 0,
      revokeGoogleToken: async () => {},
    },
  });
  routes = {
    emails: await import(src("app/api/emails/route.ts")),
    "emails/id": await import(src("app/api/emails/[id]/route.ts")),
    "emails/bulk": await import(src("app/api/emails/bulk/route.ts")),
    rules: await import(src("app/api/rules/route.ts")),
    push: await import(src("app/api/push/route.ts")),
    "settings/ai": await import(src("app/api/settings/ai/route.ts")),
    account: await import(src("app/api/account/route.ts")),
  } as never;

  for (const u of [A, B]) await sb!.from("users").delete().eq("email", u);
  const users = await sb!.from("users").insert([
    { email: A, refresh_token: "v1:a-token", gemini_key_enc: "v1:a-key", ai_consent: true },
    { email: B, refresh_token: "v1:b-token" },
  ]);
  assert.equal(users.error, null, users.error?.message);
  const emails = await sb!.from("emails").insert([
    mail(A, "a1", { deadline: iso(20), user_corrected: true, unread: true }),
    mail(A, "a2", { priority: "later", unread: true }),
    mail(A, "shared", { unread: true }), // the same Gmail id in both inboxes
    mail(B, "b1"),
    mail(B, "shared", { unread: true }),
  ]);
  assert.equal(emails.error, null, emails.error?.message);
  const push = await sb!.from("push_subscriptions").insert({ endpoint: "https://push.example/a-device", user_email: A, p256dh: "p".repeat(20), auth: "a".repeat(10) });
  assert.equal(push.error, null, push.error?.message);
});

after(async () => {
  if (skip) return;
  for (const u of [A, B]) await sb!.from("users").delete().eq("email", u);
});

test("A sees A's own mail (so the checks below aren't empty)", { skip }, async () => {
  who = A;
  const r = await call("emails", "GET");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.emails.map((m: { id: string }) => m.id).sort(), ["a1", "a2", "shared"]);
  assert.equal((await call("emails/id", "GET", { id: "a1" })).status, 200);
  who = B;
});

test("B can't read A's mail through any route", { skip }, async () => {
  who = B;
  const before = await snapshot(A);
  for (const query of ["", "?q=hostel", "?due=1", "?priority=very_important", "?days=7", `?before=${encodeURIComponent(iso(1))}`]) {
    const r = await call("emails", "GET", { query });
    assert.equal(r.status, 200, `${query} ${JSON.stringify(r.body)}`);
    for (const m of r.body.emails) assert.equal(m.user_email, B, `GET /api/emails${query} returned ${m.user_email}'s mail`);
  }
  assert.equal((await call("emails/id", "GET", { id: "a1" })).status, 404);
  const rules = await call("rules", "GET");
  assert.ok(!JSON.stringify(rules.body).includes("a.vit.ac.in"), "rules leaked A's sender");
  const ai = await call("settings/ai", "GET");
  assert.equal(ai.body.ownKey, false, "B sees A's Gemini key");
  assert.equal(await snapshot(A), before);
});

test("B can't change A's mail, rules, devices or key through any route", { skip }, async () => {
  who = B;
  const before = await snapshot(A);
  await call("emails", "PATCH", { body: { id: "a1", priority: "noise", is_done: true, read: true } });
  await call("emails", "PATCH", { body: { id: "a1", deadline: null } });
  await call("emails", "PATCH", { body: { id: "shared", priority: "noise", read: true } });
  const bulk = await call("emails/bulk", "POST", { body: { ids: ["a1", "a2"], read: true, priority: "noise", is_done: true } });
  assert.equal(bulk.body.updated, 0);
  await call("rules", "DELETE", { query: "?from=dsw@a.vit.ac.in" });
  await call("push", "DELETE", { query: `?endpoint=${encodeURIComponent("https://push.example/a-device")}` });
  await call("settings/ai", "DELETE");
  await call("settings/ai", "POST", { body: { consent: false } });
  assert.equal(await snapshot(A), before, "a route changed A's rows");
  // B's own copy of the shared id did change
  const mine = await sb!.from("emails").select("priority, unread").eq("user_email", B).eq("id", "shared").single();
  assert.deepEqual(mine.data, { priority: "noise", unread: false });
});

test("B deleting B's account leaves A untouched", { skip }, async () => {
  who = B;
  const before = await snapshot(A);
  const r = await call("account", "DELETE", { body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await snapshot(A), before);
  const left = await sb!.from("emails").select("id").eq("user_email", B);
  assert.deepEqual(left.data, []);
});
