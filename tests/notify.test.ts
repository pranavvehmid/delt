import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PER_RUN, planNotifications, type NotifyMail } from "../src/lib/notify-plan";

const NOW = Date.parse("2026-11-05T12:00:00+05:30");
const H = 3600_000;
let n = 0;
const m = (o: Partial<NotifyMail>): NotifyMail => ({
  id: `m${++n}`,
  subject: "Mail",
  from_name: "COE",
  summary: "",
  priority: "priority",
  received_at: new Date(NOW - H).toISOString(),
  deadline: null,
  unread: true,
  is_done: false,
  notified: false,
  reminded: false,
  ...o,
});

test("new unread Urgent mail is announced once", () => {
  const p = planNotifications([m({ priority: "very_important", subject: "CAT-1 schedule" })], NOW);
  assert.equal(p.length, 1);
  assert.equal(p[0].kind, "urgent");
  assert.equal(p[0].title, "CAT-1 schedule");
  assert.match(p[0].url, /^\/#\/mail\//);
  assert.equal(planNotifications([m({ priority: "very_important", notified: true })], NOW).length, 0);
});

test("no pings for read, done, old or non-urgent mail", () => {
  const p = planNotifications(
    [
      m({ priority: "very_important", unread: false }),
      m({ priority: "very_important", is_done: true }),
      m({ priority: "very_important", received_at: new Date(NOW - 30 * H).toISOString() }),
      m({ priority: "priority" }),
      m({ priority: "noise" }),
    ],
    NOW,
  );
  assert.equal(p.length, 0);
});

test("deadlines due within 24 hours get one reminder", () => {
  const soon = m({ deadline: new Date(NOW + 5 * H).toISOString(), unread: false, subject: "DA-2" });
  const p = planNotifications([soon], NOW);
  assert.deepEqual([p[0].kind, p[0].body], ["deadline", "DA-2"]);
  assert.match(p[0].title, /^Due today/);
  assert.equal(planNotifications([{ ...soon, reminded: true }], NOW).length, 0);
});

test("no reminder for far, past, done or noise deadlines", () => {
  const p = planNotifications(
    [
      m({ deadline: new Date(NOW + 30 * H).toISOString() }),
      m({ deadline: new Date(NOW - H).toISOString() }),
      m({ deadline: new Date(NOW + H).toISOString(), is_done: true }),
      m({ deadline: new Date(NOW + H).toISOString(), priority: "noise" }),
    ],
    NOW,
  );
  assert.equal(p.length, 0);
});

test("never more than a few at once", () => {
  const lots = Array.from({ length: 20 }, () => m({ priority: "very_important" }));
  assert.equal(planNotifications(lots, NOW).length, MAX_PER_RUN);
});
