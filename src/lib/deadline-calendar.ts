import { istDay } from "./inbox";

export type CalendarView = "week" | "month";
const DAY = 86_400_000;

// Dates in the grid are UTC midnights representing calendar dates in India.
export const calendarDay = (instant: number) => Date.parse(istDay(instant));
const monday = (day: number) => day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;

export function calendarDays(anchor: number, view: CalendarView): number[] {
  if (view === "week") return Array.from({ length: 7 }, (_, i) => monday(anchor) + i * DAY);
  const date = new Date(anchor);
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  const first = monday(Date.UTC(year, month, 1));
  const last = monday(Date.UTC(year, month + 1, 0)) + 6 * DAY;
  return Array.from({ length: (last - first) / DAY + 1 }, (_, i) => first + i * DAY);
}

export function moveCalendar(anchor: number, view: CalendarView, step: -1 | 1): number {
  if (view === "week") return anchor + step * 7 * DAY;
  const date = new Date(anchor);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1);
}

export function deadlineKind(mail: { category: string; reason: string | null; subject: string | null }) {
  if (mail.category === "exam") return "Exam";
  if (mail.category === "registration") return "Registration";
  if (mail.category === "deadline" && /\bfees?\b/i.test(`${mail.reason ?? ""} ${mail.subject ?? ""}`)) return "Fees";
  return "Other";
}
