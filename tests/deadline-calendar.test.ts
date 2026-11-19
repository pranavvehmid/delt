import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDay, calendarDays, moveCalendar } from "../src/lib/deadline-calendar";

test("calendar dates follow IST, with weeks running Monday to Sunday", () => {
  const day = calendarDay(Date.parse("2026-12-31T20:00:00Z"));
  assert.equal(day, Date.parse("2027-01-01"));
  const week = calendarDays(day, "week");
  assert.equal(week[0], Date.parse("2026-12-28"));
  assert.equal(week[6], Date.parse("2027-01-03"));
});

test("month dates fill whole weeks and navigation crosses year boundaries", () => {
  const anchor = Date.parse("2026-12-15");
  const next = moveCalendar(anchor, "month", 1);
  assert.equal(next, Date.parse("2027-01-01"));
  assert.equal(calendarDays(next, "month").length, 35);
  assert.equal(moveCalendar(next, "month", -1), Date.parse("2026-12-01"));
});
