// Issue #14: the inbox saved on the phone for offline use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFLINE_MAX, cacheKey, packCache, unpackCache } from "../src/lib/offline";

const NOW = Date.parse("2026-11-05T12:00:00Z");

test("saves and reads back the newest mails and the deadlines", () => {
  const mails = Array.from({ length: 450 }, (_, i) => ({ id: `m${i}` }));
  const c = unpackCache<{ id: string }>(packCache(mails, [{ id: "d" }], NOW), NOW + 1000);
  assert.ok(c);
  assert.equal(c.mails.length, OFFLINE_MAX);
  assert.equal(c.mails[0].id, "m0");
  assert.deepEqual(c.due, [{ id: "d" }]);
  assert.equal(c.at, NOW);
});

test("ignores missing, broken, old-version and month-old saves", () => {
  assert.equal(unpackCache(null, NOW), null);
  assert.equal(unpackCache("{not json", NOW), null);
  assert.equal(unpackCache(JSON.stringify({ v: 0, at: NOW, mails: [], due: [] }), NOW), null);
  assert.equal(unpackCache(JSON.stringify({ v: 1, at: NOW, mails: "x", due: [] }), NOW), null);
  assert.equal(unpackCache(packCache([], [], NOW - 31 * 86400_000), NOW), null);
  assert.ok(unpackCache(packCache([], [], NOW - 29 * 86400_000), NOW));
});

test("each account on a shared phone has its own save", () => {
  assert.equal(cacheKey("A.Student@vitstudent.ac.in"), cacheKey("a.student@vitstudent.ac.in"));
  assert.notEqual(cacheKey("a@vitstudent.ac.in"), cacheKey("b@vitstudent.ac.in"));
});

test("the service worker never caches API answers", async () => {
  const { readFileSync } = await import("node:fs");
  const sw = readFileSync("public/sw.js", "utf8");
  assert.match(sw, /pathname\.startsWith\("\/api\/"\)\) return;/);
  assert.match(sw, /req\.method !== "GET"\) return;/);
});
