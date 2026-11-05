// "Delete my data" (issue #9): after deleting, nothing about the student is left,
// and other students' data is untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDENT_TABLES, deleteStudentData, type AccountDb, type AccountGoogle } from "../src/lib/account";

type Row = Record<string, string>;
const A = "a.student2026@vitstudent.ac.in";
const B = "b.student2026@vitstudent.ac.in";

function fakeDb(missing: string[] = []) {
  const tables: Record<string, Row[]> = {
    users: [{ email: A, refresh_token: "rt-A" }, { email: B, refresh_token: "rt-B" }],
    emails: [{ id: "1", user_email: A }, { id: "2", user_email: A }, { id: "1", user_email: B }],
    deadlines: [{ id: "d", user_email: A }],
    push_subscriptions: [{ endpoint: "e1", user_email: A }, { endpoint: "e2", user_email: B }],
    app_state: [{ key: "gemini_cooldown_until" }],
  };
  const db: AccountDb = {
    from(t) {
      return {
        select: () => ({
          eq: (c, v) => ({ maybeSingle: async () => ({ data: tables[t].find((r) => r[c] === v) ?? null, error: null }) }),
        }),
        delete: () => ({
          eq: async (c, v) => {
            if (missing.includes(t)) return { error: { message: `relation "${t}" does not exist` } };
            tables[t] = tables[t].filter((r) => r[c] !== v);
            return { error: null };
          },
        }),
      };
    },
  };
  return { db, tables };
}
function fakeGoogle(fail: { labels?: boolean; revoke?: boolean } = {}) {
  const calls: string[] = [];
  const google: AccountGoogle = {
    accessToken: async (rt) => (calls.push(`token:${rt}`), "at"),
    removeLabels: async () => {
      calls.push("labels");
      if (fail.labels) throw new Error("Gmail down");
      return 4;
    },
    revoke: async (t) => {
      calls.push(`revoke:${t}`);
      if (fail.revoke) throw new Error("offline");
      return true;
    },
  };
  return { google, calls };
}
const mentions = (tables: Record<string, Row[]>, email: string) => Object.values(tables).flat().filter((r) => Object.values(r).includes(email));

test("deletes every row about the student and nothing about anyone else", async () => {
  const { db, tables } = fakeDb();
  const { google } = fakeGoogle();
  const before = mentions(tables, B).length;
  const r = await deleteStudentData(A, db, google, { removeLabels: false });
  assert.equal(mentions(tables, A).length, 0);
  assert.equal(mentions(tables, B).length, before);
  assert.equal(tables.app_state.length, 1, "shared settings are not the student's");
  assert.deepEqual(r.tables, STUDENT_TABLES.map(([t]) => t));
});

test("revokes the Google token, and removes labels only when asked", async () => {
  const a = fakeGoogle();
  await deleteStudentData(A, fakeDb().db, a.google, { removeLabels: false });
  assert.deepEqual(a.calls, ["revoke:rt-A"]);
  const b = fakeGoogle();
  const r = await deleteStudentData(A, fakeDb().db, b.google, { removeLabels: true });
  assert.deepEqual(b.calls, ["token:rt-A", "labels", "revoke:rt-A"]);
  assert.equal(r.labelsRemoved, 4);
  assert.equal(r.googleRevoked, true);
});

test("Google being down never stops the database delete", async () => {
  const { db, tables } = fakeDb();
  const { google } = fakeGoogle({ labels: true, revoke: true });
  const r = await deleteStudentData(A, db, google, { removeLabels: true });
  assert.equal(mentions(tables, A).length, 0);
  assert.equal(r.googleRevoked, false);
  assert.equal(r.notes.length, 2);
});

test("an older database without some tables still deletes the rest", async () => {
  const { db, tables } = fakeDb(["deadlines", "push_subscriptions"]);
  await deleteStudentData(A, db, fakeGoogle().google, { removeLabels: false });
  assert.equal(tables.emails.filter((r) => r.user_email === A).length, 0);
  assert.equal(tables.users.filter((r) => r.email === A).length, 0);
});

test("a student with no saved account is a no-op, not an error", async () => {
  const { db } = fakeDb();
  const g = fakeGoogle();
  await deleteStudentData("nobody@vitstudent.ac.in", db, g.google, { removeLabels: true });
  assert.deepEqual(g.calls, []);
});

test("every table in the schema that names a student is on the delete list", () => {
  const sql = readFileSync("supabase/schema.sql", "utf8");
  const listed = new Set<string>(STUDENT_TABLES.map(([t]) => t));
  for (const m of sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    if (/\b(user_)?email\s+text/.test(m[2])) assert.ok(listed.has(m[1]), `${m[1]} holds student data but isn't deleted`);
  }
});
