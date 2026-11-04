// Stress: the sorter must never crash, always answer with a valid pile, and stay fast.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRules } from "../src/lib/rules";
import { CATEGORIES, PRIORITIES } from "../src/lib/types";

const NOW = Date.parse("2026-11-03T10:00:00+05:30");
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const WORDS = ["hackathon", "register", "last date", "CAT-1", "quiz", "fee", "scholarship", "congratulations", "webinar", "- reg", "Fwd:", "Re:",
  "deadline", "only for final year", "2025 batch", "50% off", "FFCS", "VTOP", "interview", "results", "🎉", "வணக்கம்", "₹1,00,000", "31/02/2026",
  "99/99/9999", "tomorrow", "today", "Nov", "13th", "PM", "a.m.", "(", ")", "[", "]", "*", "?", "+", "\\", "$", "^", "|"];
const DOMAINS = ["vit.ac.in", "vitstudent.ac.in", "gmail.com", "google.com", "unstop.com", "x.y"];

function randomText(n: number) {
  return Array.from({ length: n }, () => pick(WORDS)).join(" ");
}

test("3000 random mails: never throws, always a valid pile and category", () => {
  for (let i = 0; i < 3000; i++) {
    const msg = {
      id: String(i), threadId: String(i), fromName: randomText(2), fromAddress: `a${i}@${pick(DOMAINS)}`,
      subject: randomText(Math.floor(rnd() * 12)), snippet: "", receivedAt: new Date(NOW - rnd() * 30 * 86400_000),
      body: randomText(Math.floor(rnd() * 80)), unread: rnd() > 0.5,
    };
    const r = classifyByRules(msg, [], undefined, NOW);
    assert.ok(PRIORITIES.includes(r.priority), `bad priority for: ${msg.subject}`);
    assert.ok((CATEGORIES as readonly string[]).includes(r.category), `bad category for: ${msg.subject}`);
    assert.ok(r.confidence >= 0 && r.confidence <= 1);
    if (r.deadline) assert.ok(!isNaN(Date.parse(r.deadline)), `bad deadline ${r.deadline}`);
    assert.ok(r.summary.length <= 220);
  }
});

test("empty mail and huge mail are handled", () => {
  const empty = classifyByRules({ id: "e", threadId: "e", fromName: "", fromAddress: "", subject: "", snippet: "", receivedAt: new Date(NOW), body: "", unread: true }, [], undefined, NOW);
  assert.ok(PRIORITIES.includes(empty.priority));

  const huge = "Register for the hackathon. ".repeat(8000); // ~220 KB
  const t0 = performance.now();
  const r = classifyByRules({ id: "h", threadId: "h", fromName: "S", fromAddress: "s@vit.ac.in", subject: "Big mail", snippet: "", receivedAt: new Date(NOW), body: huge, unread: true }, [], undefined, NOW);
  assert.ok(performance.now() - t0 < 200, "huge mail took too long");
  assert.ok(PRIORITIES.includes(r.priority));
});

test("speed: 1000 typical mails sort in under a second", () => {
  const body = "Dear students, registrations for HackVIT 2026 are open. Last date to register is 15th November 2026, 11:59 PM. Team size 2-4.";
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    classifyByRules({ id: String(i), threadId: "t", fromName: "S", fromAddress: "s@vit.ac.in", subject: `HackVIT ${i} - Registrations Open`, snippet: "", receivedAt: new Date(NOW), body, unread: true }, [], undefined, NOW);
  }
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `took ${Math.round(ms)} ms`);
});

test("impossible dates (31 Feb, 99/99) never become deadlines", () => {
  const r = classifyByRules({ id: "d", threadId: "d", fromName: "S", fromAddress: "s@vit.ac.in", subject: "Register now", snippet: "", receivedAt: new Date(NOW), body: "Last date 99/99/9999 or 45/13/2026.", unread: true }, [], undefined, NOW);
  assert.equal(r.deadline, null);
});

test("dates that don't exist (31 Feb, 31 Nov) are ignored; 29 Feb only in leap years", () => {
  const read = (body: string) =>
    classifyByRules({ id: "d", threadId: "d", fromName: "S", fromAddress: "s@vit.ac.in", subject: "Register now", snippet: "", receivedAt: new Date(NOW), body, unread: true }, [], undefined, NOW).deadline;
  assert.equal(read("Last date 31/02/2027."), null);
  assert.equal(read("Last date 31 November 2026."), null);
  assert.equal(read("Last date 29/02/2027."), null);
  assert.equal(read("Last date 29/02/2028."), "2028-02-29T23:59:00+05:30");
  assert.equal(read("Last date 30 November 2026."), "2026-11-30T23:59:00+05:30");
});

test("a month and year alone ('November 2026') is not a date", () => {
  const r = classifyByRules({ id: "m", threadId: "m", fromName: "S", fromAddress: "s@vit.ac.in", subject: "Register now", snippet: "", receivedAt: new Date(NOW), body: "Applications for the November 2026 cycle are open. Last date: see portal.", unread: true }, [], undefined, NOW);
  assert.equal(r.deadline, null);
});
