// Issue #28: sync never skips mail for good, however much arrives at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BATCH, LIST_MAX, MAX_STUCK_MS, isGone, nextSyncedAt, planSync } from "../src/lib/sync-plan";

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `m${from + i}`);

test("a busy first sync (400 new mails) is finished over several runs, nothing skipped", () => {
  const listed = ids(400); // newest first, as Gmail lists them
  const known = new Set<string>();
  let previous: string | null = null;
  const saved: string[] = [];
  for (let run = 0; run < 10; run++) {
    const startedAt = new Date(Date.UTC(2026, 10, 5, 12, run)).toISOString();
    const p = planSync(listed, known);
    p.batch.forEach((id) => (known.add(id), saved.push(id)));
    previous = nextSyncedAt({ previous, startedAt, left: p.left, failed: 0 });
    if (previous) break;
  }
  assert.equal(new Set(saved).size, 400);
  assert.deepEqual(saved.slice(0, 3), ["m0", "m1", "m2"], "newest first");
  assert.ok(previous, "the window closes once everything is in");
});

test("the window stays open while mail is left or a download failed", () => {
  const prev = "2026-11-05T10:00:00Z", now = "2026-11-05T12:00:00Z";
  assert.equal(nextSyncedAt({ previous: prev, startedAt: now, left: 5, failed: 0 }), prev);
  assert.equal(nextSyncedAt({ previous: prev, startedAt: now, left: 0, failed: 1 }), prev);
  assert.equal(nextSyncedAt({ previous: prev, startedAt: now, left: 0, failed: 0 }), now);
  assert.equal(nextSyncedAt({ previous: null, startedAt: now, left: 3, failed: 0 }), null, "first sync stays first until done");
});

test("one mail that always fails can't hold the window open forever", () => {
  const prev = "2026-11-01T00:00:00Z";
  const later = new Date(Date.parse(prev) + MAX_STUCK_MS + 1000).toISOString();
  assert.equal(nextSyncedAt({ previous: prev, startedAt: later, left: 0, failed: 1 }), later);
});

test("mail already saved (the 1-hour overlap) isn't downloaded again or counted as new", () => {
  const p = planSync(ids(10), new Set(ids(7)));
  assert.deepEqual(p.batch, ["m7", "m8", "m9"]);
  assert.equal(p.left, 0);
});

test("batch and listing limits", () => {
  const p = planSync(ids(BATCH + 20), new Set());
  assert.equal(p.batch.length, BATCH);
  assert.equal(p.left, 20);
  assert.equal(planSync(ids(LIST_MAX), new Set()).listCapped, true);
  assert.equal(planSync(ids(10), new Set()).listCapped, false);
});

test("a mail deleted between listing and download isn't a failure", () => {
  assert.ok(isGone("Gmail /messages/abc failed (404): Not Found"));
  assert.ok(!isGone("Gmail /messages/abc failed (500): oops"));
});
