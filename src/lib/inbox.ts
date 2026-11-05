// Pure helpers behind the inbox and deadline screens. No React, no network:
// everything here is unit tested in tests/inbox.test.ts.
import type { EmailRow, Priority } from "./supabase";
import { subjectKey } from "./insights";

export type Mail = Pick<
  EmailRow,
  "id" | "from_name" | "from_address" | "subject" | "summary" | "snippet" | "received_at" | "priority" | "category" | "deadline" | "is_done" | "unread"
>;

export const PILES: { key: Priority; label: string }[] = [
  { key: "very_important", label: "Urgent" },
  { key: "priority", label: "Priority" },
  { key: "later", label: "Later" },
  { key: "noise", label: "Noise" },
];
export const pileLabel = (p: Priority) => PILES.find((x) => x.key === p)!.label;

const TZ = "Asia/Kolkata";
const DAY = 86400_000;
/** Calendar day in IST, e.g. "2026-11-04". */
export const istDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });

export const cleanSender = (n: string | null) => (n ?? "").replace(/\s+via\s+.*$/i, "").replace(/['"]/g, "").trim() || "Unknown sender";
export const cleanSubject = (s: string | null) =>
  (s ?? "").replace(/\s*[-–:]?\s*reg\.?$/i, "").replace(/^((fwd?|re|fw):\s*)+/i, "").trim() || "(no subject)";
export const initials = (n: string) =>
  n.split(/[\s-]+/).filter((w) => /^[a-z]/i.test(w) && !/^(of|the|and|for|at|in|to)$/i.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export type Filter = { pile: Priority | "all"; unreadOnly: boolean; query: string };

/** Mail matching the chips and search box, newest first. Nothing is ever hidden by "All". */
export function filterMail<T extends Mail>(mails: T[], f: Filter): T[] {
  const q = f.query.trim().toLowerCase();
  return mails
    .filter((m) => f.pile === "all" || m.priority === f.pile)
    .filter((m) => !f.unreadOnly || m.unread)
    .filter((m) => !q || [m.subject, m.from_name, m.from_address, m.summary].some((s) => s?.toLowerCase().includes(q)))
    .sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
}

/** Count per chip: total and unread for All and each pile. */
export function pileCounts(mails: Mail[]) {
  const out: Record<Priority | "all", { total: number; unread: number }> = {
    all: { total: 0, unread: 0 },
    very_important: { total: 0, unread: 0 },
    priority: { total: 0, unread: 0 },
    later: { total: 0, unread: 0 },
    noise: { total: 0, unread: 0 },
  };
  for (const m of mails) {
    for (const k of ["all", m.priority] as const) {
      out[k].total++;
      if (m.unread) out[k].unread++;
    }
  }
  return out;
}

/** "Today", "Yesterday", or "Mon, 2 Nov" (IST). */
export function dayLabel(t: number, now: number) {
  const d = istDay(t);
  if (d === istDay(now)) return "Today";
  if (d === istDay(now - DAY)) return "Yesterday";
  return new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

/** Splits an already-sorted list into day sections, keeping order. */
export function groupByDay<T extends Mail>(mails: T[], now: number) {
  const groups: { key: string; label: string; mails: T[] }[] = [];
  for (const m of mails) {
    const t = Date.parse(m.received_at);
    const key = istDay(t);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.mails.push(m);
    else groups.push({ key, label: dayLabel(t, now), mails: [m] });
  }
  return groups;
}

/** Row time: "4:05 pm" for today, "Yesterday", or "2 Nov". */
export function shortTime(iso: string, now: number) {
  const t = Date.parse(iso);
  if (istDay(t) === istDay(now)) return new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  if (istDay(t) === istDay(now - DAY)) return "Yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
}

/** "just now", "3 min ago", "2 h ago". */
export function ago(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < DAY / 1000) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** Due text for chips: "overdue", "today 6 pm", "tomorrow", "in 3 days", "12 Nov". */
export function dueText(iso: string, now: number) {
  const t = Date.parse(iso);
  if (t < now) return "overdue";
  const days = Math.round((Date.parse(istDay(t)) - Date.parse(istDay(now))) / DAY);
  const time = new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(":00", "");
  if (days === 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `in ${days} days`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
}

/** How close a deadline is: drives the chip colour. */
export function dueLevel(iso: string, now: number): "over" | "soon" | "week" | "far" {
  const d = (Date.parse(iso) - now) / DAY;
  return d < 0 ? "over" : d < 2 ? "soon" : d < 7 ? "week" : "far";
}

export type Bucket = "Overdue" | "Today" | "Tomorrow" | "This week" | "Later" | "Done";
export const BUCKETS: Bucket[] = ["Overdue", "Today", "Tomorrow", "This week", "Later", "Done"];

/**
 * Deadlines straight from mail. Noise is ignored, repeats (reminders, Fwd)
 * keep only the newest, overdue items older than 7 days drop off, and finished
 * ones go to Done so they are still findable.
 */
export function deadlineBuckets<T extends Mail>(mails: T[], now: number) {
  const withDue = mails.filter((m) => m.deadline && m.priority !== "noise");
  // newest mail per subject wins
  const seen = new Map<string, T>();
  for (const m of [...withDue].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at))) {
    const k = subjectKey(m.subject) || m.id;
    if (!seen.has(k)) seen.set(k, m);
  }
  const out = Object.fromEntries(BUCKETS.map((b) => [b, [] as T[]])) as Record<Bucket, T[]>;
  const today = istDay(now);
  for (const m of seen.values()) {
    const t = Date.parse(m.deadline!);
    if (m.is_done) {
      out.Done.push(m);
      continue;
    }
    if (t < now) {
      if (now - t <= 7 * DAY) out.Overdue.push(m);
      continue;
    }
    const days = Math.round((Date.parse(istDay(t)) - Date.parse(today)) / DAY);
    out[days === 0 ? "Today" : days === 1 ? "Tomorrow" : days < 7 ? "This week" : "Later"].push(m);
  }
  for (const b of BUCKETS) out[b].sort((a, b2) => Date.parse(a.deadline!) - Date.parse(b2.deadline!));
  out.Done.reverse();
  return out;
}

/** Number of deadlines that still need you (for the tab badge). */
export const openDeadlines = (b: Record<Bucket, unknown[]>) => b.Overdue.length + b.Today.length + b.Tomorrow.length + b["This week"].length;

/**
 * A pre-filled "Mail in the wrong pile" GitHub issue (issue #1). Only the subject,
 * sender name and pile go in; never the mail body or addresses. The student sees
 * it on GitHub and can edit or cancel before posting.
 */
export function wrongPileLink(subject: string, sender: string, pile: string) {
  const body = [
    `**Subject line**\n${subject}`,
    `**Sender**\n${sender}`,
    `**DELT put it in:** ${pile}`,
    `**It should be in:** Urgent / Priority / Later / Noise`,
    `**Why**\n`,
    `**Your batch year** (for example 2026)\n`,
    `_This issue is public. Remove anything private before posting._`,
  ].join("\n\n");
  const q = new URLSearchParams({ title: `Wrong pile: ${subject}`.slice(0, 120), labels: "sorting", body });
  return `https://github.com/pranavvehmid/delt/issues/new?${q.toString()}`;
}

// ---------- loading more than one page (issue #11) ----------
export const PAGE_SIZE = 200;
const newestFirst = (a: Mail, b: Mail) => Date.parse(b.received_at) - Date.parse(a.received_at);

/** A fresh first page replaces the newest part of what's loaded; older pages already loaded stay. */
export function mergeFresh<T extends Mail>(loaded: T[], page: T[], more: boolean): T[] {
  if (!more || page.length === 0) return page; // the page is everything there is
  const edge = Math.min(...page.map((m) => Date.parse(m.received_at)));
  const ids = new Set(page.map((m) => m.id));
  return [...page, ...loaded.filter((m) => Date.parse(m.received_at) < edge && !ids.has(m.id))].sort(newestFirst);
}

/** Adds an older page (or search results) without duplicates. Mail already loaded wins, so
 *  a change made on screen isn't undone by an older copy. */
export function mergeMore<T extends Mail>(loaded: T[], extra: T[]): T[] {
  const byId = new Map(loaded.map((m) => [m.id, m]));
  for (const m of extra) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort(newestFirst);
}

/** Where the next older page starts: the oldest loaded mail. */
export const oldestReceived = (mails: Mail[]) =>
  mails.length ? mails.reduce((o, m) => (Date.parse(m.received_at) < Date.parse(o) ? m.received_at : o), mails[0].received_at) : null;

/** Search words made safe for the database filter: no commas, brackets, quotes or wildcards.
 *  Words are joined by "%" so "b tech" also finds "B.Tech". Empty means no server search. */
export function searchPattern(q: string): string {
  const words = q.replace(/[%_*,()\\"'.:;]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const text = words.join("%").slice(0, 80);
  return text.length >= 2 ? `%${text}%` : "";
}
