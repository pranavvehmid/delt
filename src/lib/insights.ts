// Pure helpers used by the app and covered by tests (no network, no React).
import type { EmailRow } from "./supabase";

// ---------- duplicates: reminders, replies and forwards of the same mail ----------

export function subjectKey(subject: string | null) {
  return (subject ?? "")
    .toLowerCase()
    .replace(/\s*[-–:]?\s*reg\.?$/i, "")
    .replace(/^((fwd?|re|fw):\s*)+/i, "")
    .replace(/^((final )?reminder|last chance|gentle reminder)[:\s-]*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Keeps the newest mail of each thread-like group (same cleaned subject). */
export function dedupe<T extends Pick<EmailRow, "subject" | "received_at">>(mails: T[]): T[] {
  const seen = new Set<string>();
  return [...mails]
    .sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at))
    .filter((m) => {
      const k = subjectKey(m.subject);
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// ---------- Google Calendar link (no extra permission needed) ----------

const gcal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A link that opens Google Calendar with the event filled in. Default: a 30-minute slot ending at the deadline. */
export function calendarLink(title: string, dueISO: string, details = "", minutes = 30) {
  const end = new Date(dueISO);
  const start = new Date(end.getTime() - minutes * 60_000);
  const p = new URLSearchParams({ action: "TEMPLATE", text: `⏱ ${title}`, dates: `${gcal(start)}/${gcal(end)}`, details: details || "Deadline from DELT" });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// ---------- List-Unsubscribe header ----------

/** Picks a usable unsubscribe link from a List-Unsubscribe header: an https link first, else mailto. */
export function parseUnsubscribe(header: string | null | undefined): string | null {
  if (!header) return null;
  const links = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
  return links.find((l) => /^https:\/\//i.test(l)) ?? links.find((l) => /^mailto:/i.test(l)) ?? null;
}
