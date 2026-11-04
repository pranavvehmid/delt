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

// ---------- senders ----------

export type SenderStat = { address: string; name: string; total: number; unread: number; topPriority: EmailRow["priority"]; ids: string[] };
const RANK = { very_important: 0, priority: 1, later: 2, noise: 3 } as const;

/** Who mails you most, with unread counts, busiest first. */
export function senderStats(mails: Pick<EmailRow, "id" | "from_address" | "from_name" | "unread" | "priority">[]): SenderStat[] {
  const map = new Map<string, SenderStat>();
  for (const m of mails) {
    const address = (m.from_address ?? "unknown").toLowerCase();
    const s = map.get(address) ?? { address, name: (m.from_name ?? address).replace(/\s+via\s+.*$/i, "").replace(/['"]/g, "").trim(), total: 0, unread: 0, topPriority: "noise", ids: [] };
    s.total++;
    if (m.unread) s.unread++;
    if (RANK[m.priority] < RANK[s.topPriority]) s.topPriority = m.priority;
    s.ids.push(m.id);
    map.set(address, s);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.unread - a.unread || a.address.localeCompare(b.address));
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

// ---------- interests ----------

export const INTERESTS: { key: string; label: string; words: RegExp }[] = [
  { key: "ai", label: "AI / ML", words: /\b(ai|ml|machine learning|deep learning|data science|genai|llm|neural)\b/i },
  { key: "web", label: "Web & apps", words: /\b(web|app|frontend|backend|full ?stack|android|ios|flutter|react)\b/i },
  { key: "code", label: "Competitive coding", words: /\b(coding|codechef|codeforces|leetcode|dsa|algorithm|cp contest|icpc)\b/i },
  { key: "robotics", label: "Robotics & hardware", words: /\b(robot\w*|iot|embedded|drone|electronics|hardware|ev|motorcycle|automotive)\b/i },
  { key: "design", label: "Design", words: /\b(design|ui|ux|figma|poster|creative)\b/i },
  { key: "startup", label: "Startups & ideas", words: /\b(startup|entrepreneur\w*|pitch\w*|ideathon|innovation|incubat\w*|product)\b/i },
  { key: "security", label: "Cyber security", words: /\b(cyber|security|ctf|hacking|forensics)\b/i },
  { key: "finance", label: "Finance", words: /\b(finance|fintech|trading|stock|investment|banking)\b/i },
];

/** How many of your interests a mail matches (0 when you picked none). */
export function interestScore(text: string, picked: string[]) {
  return INTERESTS.filter((i) => picked.includes(i.key) && i.words.test(text)).length;
}

// ---------- List-Unsubscribe header ----------

/** Picks a usable unsubscribe link from a List-Unsubscribe header: an https link first, else mailto. */
export function parseUnsubscribe(header: string | null | undefined): string | null {
  if (!header) return null;
  const links = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
  return links.find((l) => /^https:\/\//i.test(l)) ?? links.find((l) => /^mailto:/i.test(l)) ?? null;
}

// ---------- inbox progress ----------

/** Share of the last 7 days' mail you have dealt with (read or done). */
export function clearRate(mails: Pick<EmailRow, "unread" | "is_done" | "received_at">[], now: number) {
  const week = mails.filter((m) => now - Date.parse(m.received_at) < 7 * 86400_000);
  if (!week.length) return 100;
  return Math.round((week.filter((m) => !m.unread || m.is_done).length / week.length) * 100);
}
