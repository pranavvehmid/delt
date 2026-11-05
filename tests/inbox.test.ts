import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, deadlineBuckets, dayLabel, dueLevel, dueText, filterMail, groupByDay, openDeadlines, pileCounts, shortTime, type Mail } from "../src/lib/inbox";

// Wed 4 Nov 2026, 12:00 IST
const NOW = Date.parse("2026-11-04T12:00:00+05:30");
const H = 3600_000;
let n = 0;
const mail = (o: Partial<Mail> = {}): Mail => ({
  id: `m${++n}`,
  from_name: "Office of SW",
  from_address: "sw@vit.ac.in",
  subject: `Mail ${n}`,
  summary: "",
  snippet: "",
  received_at: new Date(NOW - H).toISOString(),
  priority: "priority",
  category: "announcement",
  deadline: null,
  is_done: false,
  unread: false,
  ...o,
});

test("All shows every pile; nothing disappears when a mail changes pile", () => {
  const list = [mail({ priority: "very_important" }), mail({ priority: "later" }), mail({ priority: "noise" }), mail({ is_done: true })];
  assert.equal(filterMail(list, { pile: "all", unreadOnly: false, query: "" }).length, 4);
  assert.equal(filterMail(list, { pile: "later", unreadOnly: false, query: "" }).length, 1);
});

test("filters combine: pile + unread + search over subject, sender and summary", () => {
  const list = [
    mail({ subject: "CAT-1 schedule", priority: "very_important", unread: true }),
    mail({ subject: "CAT-1 seating", priority: "very_important", unread: false }),
    mail({ from_name: "ACM-VIT", subject: "Hack", summary: "registrations close friday", unread: true }),
  ];
  assert.equal(filterMail(list, { pile: "very_important", unreadOnly: true, query: "" }).length, 1);
  assert.equal(filterMail(list, { pile: "all", unreadOnly: false, query: "cat-1" }).length, 2);
  assert.equal(filterMail(list, { pile: "all", unreadOnly: false, query: "acm" }).length, 1);
  assert.equal(filterMail(list, { pile: "all", unreadOnly: false, query: "FRIDAY" }).length, 1);
});

test("filterMail sorts newest first", () => {
  const a = mail({ received_at: new Date(NOW - 5 * H).toISOString() });
  const b = mail({ received_at: new Date(NOW - 1 * H).toISOString() });
  assert.deepEqual(filterMail([a, b], { pile: "all", unreadOnly: false, query: "" }).map((m) => m.id), [b.id, a.id]);
});

test("pileCounts counts totals and unread per chip", () => {
  const c = pileCounts([mail({ priority: "noise", unread: true }), mail({ priority: "noise" }), mail({ priority: "later", unread: true })]);
  assert.deepEqual(c.all, { total: 3, unread: 2 });
  assert.deepEqual(c.noise, { total: 2, unread: 1 });
  assert.deepEqual(c.very_important, { total: 0, unread: 0 });
});

test("day labels and grouping follow IST, not UTC", () => {
  assert.equal(dayLabel(NOW, NOW), "Today");
  assert.equal(dayLabel(NOW - 24 * H, NOW), "Yesterday");
  // 00:30 IST on 4 Nov is still 3 Nov in UTC: must count as Today
  assert.equal(dayLabel(Date.parse("2026-11-04T00:30:00+05:30"), NOW), "Today");
  const g = groupByDay(
    [mail({ received_at: new Date(NOW - H).toISOString() }), mail({ received_at: new Date(NOW - 2 * H).toISOString() }), mail({ received_at: new Date(NOW - 30 * H).toISOString() })],
    NOW,
  );
  assert.deepEqual(g.map((x) => [x.label, x.mails.length]), [["Today", 2], ["Yesterday", 1]]);
});

test("shortTime and ago read naturally", () => {
  assert.match(shortTime(new Date(NOW - H).toISOString(), NOW), /11:00\s?am/i);
  assert.equal(shortTime(new Date(NOW - 24 * H).toISOString(), NOW), "Yesterday");
  assert.equal(ago(NOW - 10_000, NOW), "just now");
  assert.equal(ago(NOW - 3 * 60_000, NOW), "3 min ago");
  assert.equal(ago(NOW - 2 * H, NOW), "2 h ago");
});

test("dueText and dueLevel", () => {
  assert.equal(dueText(new Date(NOW - H).toISOString(), NOW), "overdue");
  assert.match(dueText("2026-11-04T18:00:00+05:30", NOW), /^today 6\s?pm$/i);
  assert.match(dueText("2026-11-05T23:59:00+05:30", NOW), /^tomorrow/);
  assert.equal(dueText("2026-11-08T10:00:00+05:30", NOW), "in 4 days");
  assert.equal(dueText("2026-11-20T10:00:00+05:30", NOW), "20 Nov");
  assert.equal(dueLevel(new Date(NOW + 30 * H).toISOString(), NOW), "soon");
  assert.equal(dueLevel(new Date(NOW + 100 * H).toISOString(), NOW), "week");
  assert.equal(dueLevel(new Date(NOW - H).toISOString(), NOW), "over");
});

test("deadlineBuckets: only from mail, no noise, repeats merged, done kept", () => {
  const b = deadlineBuckets(
    [
      mail({ subject: "Fee due", deadline: "2026-11-04T23:59:00+05:30" }),
      mail({ subject: "Reminder: Fee due", deadline: "2026-11-04T23:59:00+05:30", received_at: new Date(NOW - 10 * H).toISOString() }),
      mail({ subject: "Hack closes", deadline: "2026-11-05T18:00:00+05:30" }),
      mail({ subject: "DA 2", deadline: "2026-11-09T23:59:00+05:30" }),
      mail({ subject: "Paper", deadline: "2026-11-30T23:59:00+05:30" }),
      mail({ subject: "Old", deadline: "2026-11-03T10:00:00+05:30" }),
      mail({ subject: "Ancient", deadline: "2026-10-01T10:00:00+05:30" }),
      mail({ subject: "Sale ends", deadline: "2026-11-05T10:00:00+05:30", priority: "noise" }),
      mail({ subject: "Quiz", deadline: "2026-11-06T10:00:00+05:30", is_done: true }),
    ],
    NOW,
  );
  assert.deepEqual(b.Today.map((m) => m.subject), ["Fee due"]);
  assert.deepEqual(b.Tomorrow.map((m) => m.subject), ["Hack closes"]);
  assert.deepEqual(b["This week"].map((m) => m.subject), ["DA 2"]);
  assert.deepEqual(b.Later.map((m) => m.subject), ["Paper"]);
  assert.deepEqual(b.Overdue.map((m) => m.subject), ["Old"]);
  assert.deepEqual(b.Done.map((m) => m.subject), ["Quiz"]);
  assert.equal(openDeadlines(b), 4);
});

test("initials skip small words and split hyphens", async () => {
  const { initials } = await import("../src/lib/inbox");
  assert.equal(initials("Office of DSW"), "OD");
  assert.equal(initials("ACM-VIT"), "AV");
  assert.equal(initials("Controller of Examinations"), "CE");
  assert.equal(initials(""), "?");
});

test("wrong-pile report link carries subject, sender and pile, nothing else", async () => {
  const { wrongPileLink } = await import("../src/lib/inbox");
  const u = new URL(wrongPileLink("CAT-1 schedule & seating", "Controller of Examinations", "Later"));
  assert.equal(u.origin + u.pathname, "https://github.com/pranavvehmid/delt/issues/new");
  assert.equal(u.searchParams.get("labels"), "sorting");
  assert.equal(u.searchParams.get("title"), "Wrong pile: CAT-1 schedule & seating");
  const body = u.searchParams.get("body")!;
  assert.match(body, /CAT-1 schedule & seating/);
  assert.match(body, /DELT put it in:\*\* Later/);
  assert.match(body, /public/);
  assert.doesNotMatch(body, /@/);
});
