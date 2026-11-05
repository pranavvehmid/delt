import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpUsage, planAI, SHARED_DAILY_PER_STUDENT, COOLDOWN_MS } from "../src/lib/ai-quota";
import { looksLikeGeminiKey, open, seal } from "../src/lib/secret";

const NOW = Date.parse("2026-11-05T12:00:00+05:30");
const base = { ownKey: null, sharedKey: "shared", sharedCooldownUntil: null, usedDay: null, usedToday: 0, now: NOW };

test("a student's own key wins and has no daily cap", () => {
  const p = planAI({ ...base, ownKey: "mine", sharedCooldownUntil: NOW + COOLDOWN_MS, usedDay: "2026-11-05", usedToday: 999 });
  assert.deepEqual([p.key, p.own, p.allowance], ["mine", true, Infinity]);
});

test("shared key: daily allowance per student, reset each IST day", () => {
  assert.equal(planAI(base).allowance, SHARED_DAILY_PER_STUDENT);
  assert.equal(planAI({ ...base, usedDay: "2026-11-05", usedToday: 20 }).allowance, SHARED_DAILY_PER_STUDENT - 20);
  assert.equal(planAI({ ...base, usedDay: "2026-11-05", usedToday: 999 }).key, null);
  // yesterday's usage doesn't count today
  assert.equal(planAI({ ...base, usedDay: "2026-11-04", usedToday: 999 }).allowance, SHARED_DAILY_PER_STUDENT);
});

test("while the shared key is resting, nobody without their own key uses AI", () => {
  assert.equal(planAI({ ...base, sharedCooldownUntil: NOW + 1000 }).key, null);
  assert.equal(planAI({ ...base, sharedCooldownUntil: NOW - 1 }).key, "shared");
});

test("no keys at all means rules only", () => {
  assert.equal(planAI({ ...base, sharedKey: undefined }).key, null);
});

test("usage counter rolls over at IST midnight", () => {
  assert.deepEqual(bumpUsage("2026-11-05", 4, 3, NOW), { ai_day: "2026-11-05", ai_calls: 7 });
  assert.deepEqual(bumpUsage("2026-11-04", 24, 3, NOW), { ai_day: "2026-11-05", ai_calls: 3 });
  // 23:30 UTC on 4 Nov is already 5 Nov in India
  assert.equal(bumpUsage(null, 0, 1, Date.parse("2026-11-04T23:30:00Z")).ai_day, "2026-11-05");
});

test("own keys are stored encrypted and can't be read with another secret", () => {
  process.env.AUTH_SECRET = "test-secret-one";
  const sealed = seal("AIzaSyExampleExampleExampleExample123");
  assert.ok(!sealed.includes("AIza"));
  assert.equal(open(sealed), "AIzaSyExampleExampleExampleExample123");
  assert.notEqual(seal("x"), seal("x"), "same input must not give the same output");
  process.env.AUTH_SECRET = "a-different-secret";
  assert.equal(open(sealed), null);
  assert.equal(open("garbage"), null);
  assert.equal(open(null), null);
});

test("key format check", () => {
  assert.ok(looksLikeGeminiKey("AIzaSyExampleExampleExampleExample123"));
  assert.ok(!looksLikeGeminiKey("hello"));
  assert.ok(!looksLikeGeminiKey("AIza Sy with spaces and more text here 12345"));
});
