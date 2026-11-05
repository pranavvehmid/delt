import { test } from "node:test";
import assert from "node:assert/strict";
import { dueForSync, syncHealth } from "../src/lib/schedule";

const NOW = Date.parse("2026-11-05T12:00:00+05:30");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const u = (email: string, syncedMinAgo: number | null, seenMinAgo: number | null) => ({
  email,
  last_synced_at: syncedMinAgo === null ? null : ago(syncedMinAgo),
  last_seen_at: seenMinAgo === null ? null : ago(seenMinAgo),
});

test("never-synced students go first", () => {
  assert.equal(dueForSync([u("a", 30, 5), u("new", null, null)], NOW)[0].email, "new");
});

test("active students are checked every ~15 minutes", () => {
  assert.deepEqual(dueForSync([u("a", 16, 60)], NOW).map((x) => x.email), ["a"]);
  assert.deepEqual(dueForSync([u("a", 5, 60)], NOW), []);
});

test("inactive students only once a day", () => {
  assert.deepEqual(dueForSync([u("old", 60, 30 * 24 * 60)], NOW), []);
  assert.deepEqual(dueForSync([u("old", 21 * 60, 30 * 24 * 60)], NOW).map((x) => x.email), ["old"]);
  assert.deepEqual(dueForSync([u("never-opened", 21 * 60, null)], NOW).map((x) => x.email), ["never-opened"]);
});

test("every student is due at least once a day, whatever else happens", () => {
  const many = Array.from({ length: 500 }, (_, i) => u(`s${i}`, 20 * 60 + i, i % 3 ? null : 10 * 24 * 60));
  assert.equal(dueForSync(many, NOW).length, 500);
});

test("most overdue first", () => {
  const order = dueForSync([u("a", 20, 1), u("b", 60, 1), u("c", 30 * 60, null)], NOW).map((x) => x.email);
  assert.deepEqual(order, ["c", "b", "a"]);
});

test("students who removed Google access are skipped until they sign in again", () => {
  const revoked = { ...u("gone", null, null), access_revoked: true };
  const back = { ...u("back", null, null), access_revoked: false };
  assert.deepEqual(dueForSync([revoked, back], NOW).map((x) => x.email), ["back"]);
});

test("sync health: how far behind active students are, and how many had problems (#40)", () => {
  const h = syncHealth(
    [
      { last_synced_at: ago(10), last_seen_at: ago(30) },
      { last_synced_at: ago(200), last_seen_at: ago(60), last_sync_error: "Gmail failed (500)" },
      { last_synced_at: ago(5), last_seen_at: null },
      { last_synced_at: ago(9000), last_seen_at: ago(10), access_revoked: true },
    ],
    NOW,
  );
  assert.deepEqual(h, { students: 3, active: 2, syncedLastHour: 2, oldestActiveMinutes: 200, withProblems: 1, revoked: 1 });
});
