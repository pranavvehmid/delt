import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarLink, dedupe, parseUnsubscribe, subjectKey } from "../src/lib/insights";

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

test("calendarLink builds a Google Calendar template ending at the deadline", () => {
  const url = new URL(calendarLink("DSA assignment", "2026-11-12T23:59:00+05:30", "from DELT"));
  assert.equal(url.hostname, "calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261112T175900Z/20261112T182900Z");
  assert.match(url.searchParams.get("text")!, /DSA assignment/);
});

test("parseUnsubscribe prefers https, falls back to mailto, ignores junk", () => {
  assert.equal(parseUnsubscribe("<mailto:u@x.com>, <https://x.com/unsub?id=1>"), "https://x.com/unsub?id=1");
  assert.equal(parseUnsubscribe("<mailto:u@x.com?subject=unsubscribe>"), "mailto:u@x.com?subject=unsubscribe");
  assert.equal(parseUnsubscribe("<http://insecure.example>"), null);
  assert.equal(parseUnsubscribe(""), null);
  assert.equal(parseUnsubscribe(undefined), null);
});

