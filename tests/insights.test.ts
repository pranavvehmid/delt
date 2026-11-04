import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarLink, clearRate, dedupe, interestScore, parseUnsubscribe, senderStats, subjectKey } from "../src/lib/insights";

const NOW = Date.parse("2026-11-03T10:00:00+05:30");
const at = (h: number) => new Date(NOW - h * 3600_000).toISOString();

test("subjectKey ignores Fwd/Re, reminders and VIT's '- reg'", () => {
  const k = subjectKey("HackVIT 2026 - Registrations Open");
  assert.equal(subjectKey("Fwd: Re: HackVIT 2026 - Registrations Open"), k);
  assert.equal(subjectKey("Reminder: HackVIT 2026 - Registrations Open - reg"), k);
  assert.equal(subjectKey("Final Reminder - HackVIT 2026 - Registrations Open"), k);
  assert.notEqual(subjectKey("HackVIT 2027 - Registrations Open"), k);
});

test("dedupe keeps only the newest of repeated mails", () => {
  const out = dedupe([
    { id: "a", subject: "Bus facility for Diwali", received_at: at(30) },
    { id: "b", subject: "Re: Bus facility for Diwali", received_at: at(5) },
    { id: "c", subject: "Quiz 4 today", received_at: at(1) },
  ] as never[]) as { id: string }[];
  assert.deepEqual(out.map((m) => m.id), ["c", "b"]);
});

test("dedupe never merges mails with empty subjects", () => {
  const out = dedupe([{ subject: "", received_at: at(1) }, { subject: "", received_at: at(2) }] as never[]);
  assert.equal(out.length, 2);
});

test("senderStats counts, sorts busiest first and keeps the highest priority", () => {
  const s = senderStats([
    { id: "1", from_address: "SW@vit.ac.in", from_name: "'Director SW' via B.Tech", unread: true, priority: "later" },
    { id: "2", from_address: "sw@vit.ac.in", from_name: "Director SW", unread: false, priority: "very_important" },
    { id: "3", from_address: "club@vit.ac.in", from_name: "Club", unread: true, priority: "noise" },
  ]);
  assert.equal(s[0].address, "sw@vit.ac.in");
  assert.equal(s[0].total, 2);
  assert.equal(s[0].unread, 1);
  assert.equal(s[0].topPriority, "very_important");
  assert.equal(s[0].name, "Director SW");
  assert.deepEqual(s[0].ids, ["1", "2"]);
});

test("calendarLink builds a Google Calendar template ending at the deadline", () => {
  const url = new URL(calendarLink("DSA assignment", "2026-11-12T23:59:00+05:30", "from DELT"));
  assert.equal(url.hostname, "calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261112T175900Z/20261112T182900Z");
  assert.match(url.searchParams.get("text")!, /DSA assignment/);
});

test("interestScore matches picked interests only", () => {
  const t = "HackVIT: build an AI app with machine learning";
  assert.equal(interestScore(t, []), 0);
  assert.equal(interestScore(t, ["ai"]), 1);
  assert.equal(interestScore(t, ["ai", "web"]), 2);
  assert.equal(interestScore(t, ["robotics"]), 0);
  assert.equal(interestScore("ARC challenge: ICE-to-Electric Motorcycle Retrofit", ["robotics"]), 1);
});

test("parseUnsubscribe prefers https, falls back to mailto, ignores junk", () => {
  assert.equal(parseUnsubscribe("<mailto:u@x.com>, <https://x.com/unsub?id=1>"), "https://x.com/unsub?id=1");
  assert.equal(parseUnsubscribe("<mailto:u@x.com?subject=unsubscribe>"), "mailto:u@x.com?subject=unsubscribe");
  assert.equal(parseUnsubscribe("<http://insecure.example>"), null);
  assert.equal(parseUnsubscribe(""), null);
  assert.equal(parseUnsubscribe(undefined), null);
});

test("clearRate is the share of this week's mail you've read or finished", () => {
  const mails = [
    { unread: false, is_done: false, received_at: at(2) },
    { unread: true, is_done: true, received_at: at(3) },
    { unread: true, is_done: false, received_at: at(4) },
    { unread: true, is_done: false, received_at: at(24 * 10) }, // older than a week: ignored
  ];
  assert.equal(clearRate(mails, NOW), 67);
  assert.equal(clearRate([], NOW), 100);
});
