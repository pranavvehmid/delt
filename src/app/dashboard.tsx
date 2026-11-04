"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { DeadlineRow, EmailRow, Priority } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/types";
import SwipeDeck from "./swipe-deck";
import { calendarLink, clearRate, INTERESTS, interestScore, senderStats } from "@/lib/insights";
import MailReader from "./mail-reader";

// ======================= look-up tables =======================

const CAT: Record<string, { label: string; fill: string; dotted?: boolean }> = {
  exam: { label: "Exam", fill: "var(--gold)" },
  registration: { label: "Register", fill: "var(--gold-soft)" },
  interview: { label: "Interview", fill: "var(--amber)" },
  deadline: { label: "Deadline", fill: "var(--gold)" },
  hackathon: { label: "Hackathon", fill: "var(--lilac)", dotted: true },
  competition: { label: "Contest", fill: "var(--lav)", dotted: true },
  announcement: { label: "Notice", fill: "var(--cream)" },
  decision: { label: "Decision", fill: "var(--cream)" },
  academic: { label: "Academics", fill: "var(--violet)" },
  account: { label: "Account", fill: "var(--mist)" },
  scholarship: { label: "Scholarship", fill: "var(--mist)" },
  placement: { label: "Placement", fill: "var(--mist)" },
  achievement: { label: "Achievement", fill: "var(--ash)" },
  club_event: { label: "Event", fill: "var(--mist)" },
  newsletter: { label: "Newsletter", fill: "var(--ash)" },
  promotion: { label: "Promo", fill: "var(--ash)" },
  other: { label: "Mail", fill: "var(--ash)" },
};
const cat = (c: string) => CAT[c] ?? CAT.other;

const PRIO: Record<Priority, { label: string; fill: string }> = {
  very_important: { label: "Urgent", fill: "var(--gold)" },
  priority: { label: "Priority", fill: "var(--cream)" },
  later: { label: "Later", fill: "var(--mist)" },
  noise: { label: "Noise", fill: "var(--ash)" },
};
const PRIO_KEYS = Object.keys(PRIO) as Priority[];

type Tab = "today" | "new" | "chances" | "deadlines" | "inbox";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "today", label: "Today", icon: "M12 3v2m0 14v2M5 12H3m18 0h-2M6.3 6.3 4.9 4.9m14.2 14.2-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  { key: "new", label: "New", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { key: "chances", label: "Chances", icon: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" },
  { key: "deadlines", label: "Deadlines", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { key: "inbox", label: "Inbox", icon: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z" },
];

const OPPORTUNITY = new Set(["hackathon", "competition"]);
const STALE_DAYS = 21;
const IST = { timeZone: "Asia/Kolkata" } as const;
const SPARK = "M29 0c1.6 15 6.4 22.4 29 29-22.6 7-27.4 14.4-29 29-1.6-14.6-6.4-22-29-29C22.6 22.4 27.4 15 29 0z";

// ======================= helpers =======================

const isPast = (e: EmailRow, now: number) =>
  e.deadline ? Date.parse(e.deadline) < now : e.priority === "very_important" && now - Date.parse(e.received_at) > STALE_DAYS * 86400_000;
const left = (iso: string, now: number) => {
  const ms = Math.max(0, Date.parse(iso) - now);
  return { d: Math.floor(ms / 86400_000), h: Math.floor((ms % 86400_000) / 3600_000), m: Math.floor((ms % 3600_000) / 60_000), ms };
};
const leftText = (iso: string, now: number) => {
  if (Date.parse(iso) < now) return "overdue";
  const { d, h, m } = left(iso, now);
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const urgencyColor = (iso: string, now: number) => {
  const days = (Date.parse(iso) - now) / 86400_000;
  return days < 0 ? "#ff5a63" : days < 2 ? "#ff5a63" : days < 7 ? "var(--amber)" : "var(--muted)";
};
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...IST });
const dayLong = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...IST });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", ...IST });
const cleanSender = (n: string | null) => (n ?? "").replace(/\s+via\s+.*$/i, "").replace(/['"]/g, "").trim() || "Unknown sender";
const cleanSubject = (s: string | null) => (s ?? "(no subject)").replace(/\s*[-–:]?\s*reg\.?$/i, "").replace(/^((fwd?|re|fw):\s*)+/i, "").trim();
const initials = (n: string) => n.split(/\s+/).filter((w) => /^[a-z]/i.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const istDayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", IST);
const istHour = () => Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, ...IST }));

// Rank for "top picks": what matters most right now.
function score(e: EmailRow, now: number) {
  let s = { very_important: 100, priority: 55, later: 15, noise: 0 }[e.priority];
  if (e.deadline) {
    const days = (Date.parse(e.deadline) - now) / 86400_000;
    if (days >= 0 && days < 7) s += (7 - days) * 9;
  }
  if (["exam", "registration", "interview", "deadline"].includes(e.category)) s += 20;
  if (OPPORTUNITY.has(e.category)) s += 10;
  if (e.unread) s += 12;
  return s;
}

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// ======================= component =======================

export default function Dashboard({ email, name, signOutAction }: { email: string; name: string; signOutAction: () => Promise<void> }) {
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [, setFocusCat] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [prioFilter, setPrioFilter] = useState<Priority | "all" | "done">("all");
  const [query, setQuery] = useState("");
  const [intro, setIntro] = useState(true);
  const [form, setForm] = useState({ title: "", date: "", time: "23:59" });
  const [interests, setInterests] = useState<string[]>([]);
  const [inboxMode, setInboxMode] = useState<"mail" | "senders">("mail");
  useEffect(() => {
    try {
      setInterests(JSON.parse(localStorage.getItem("delt-interests") ?? "[]"));
    } catch {}
  }, []);
  function toggleInterest(k: string) {
    setInterests((cur) => {
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      try {
        localStorage.setItem("delt-interests", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // hover card
  const [pop, setPop] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [popTick, setPopTick] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverable = useRef(false);

  // ---------- routing: #/today, #/new, … so a refresh keeps the tab ----------
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace(/^#\/?/, "") as Tab;
      setTab(TABS.some((t) => t.key === h) ? h : "today");
      setPop(null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => {
    window.location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  };

  // ---------- data ----------
  const load = useCallback(async () => {
    const [m, d] = await Promise.all([fetch("/api/emails?days=60"), fetch("/api/deadlines")]);
    if (m.ok) setEmails((await m.json()).emails ?? []);
    if (d.ok) setDeadlines((await d.json()).deadlines ?? []);
  }, []);
  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const data = await (await fetch("/api/sync", { method: "POST" })).json();
      setToast(data.error ? "Couldn't check mail" : data.sorted ? `${data.sorted} new mail sorted` : "All caught up ✦");
    } catch {
      setToast("Couldn't reach the server");
    }
    await load();
    setSyncing(false);
  }, [load]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    hoverable.current = window.matchMedia("(hover: hover)").matches;
    load().then(() => {
      setTimeout(() => setIntro(false), 2600);
      sync();
    });
  }, [load, sync]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (readerId) setReaderId(null);
      else if (openId) setOpenId(null);
      else setFocusCat(null);
    };
    const onScroll = () => setPopTick((t) => t + 1);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [openId, readerId]);

  // ---------- actions ----------
  type MailPatch = Partial<Pick<EmailRow, "priority" | "category" | "is_done" | "deadline_choice">> & { read?: boolean };
  async function update(id: string, patch: MailPatch, quiet = false) {
    const { read, ...fields } = patch;
    setEmails(
      (list) =>
        list?.map((e) =>
          e.id === id
            ? { ...e, ...fields, ...(read !== undefined ? { unread: !read } : {}), user_corrected: fields.priority || fields.category ? true : e.user_corrected }
            : e,
        ) ?? null,
    );
    if (!quiet) {
      if (fields.is_done !== undefined) setToast(fields.is_done ? "Ticked off ✓" : "Back on the board");
      else if (fields.priority) setToast(`Moved to ${PRIO[fields.priority].label}`);
      else if (fields.category) setToast(`Now in ${cat(fields.category).label}`);
      else if (read !== undefined) setToast(read ? "Marked read" : "Marked unread");
    }
    await fetch("/api/emails", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
  }

  async function trackDeadline(e: EmailRow) {
    if (!e.deadline) return;
    setEmails((l) => l?.map((x) => (x.id === e.id ? { ...x, deadline_choice: "tracked" } : x)) ?? null);
    const res = await fetch("/api/deadlines", { method: "POST", body: JSON.stringify({ title: cleanSubject(e.subject), due_at: e.deadline, email_id: e.id }) });
    if (res.ok) {
      const { deadline } = await res.json();
      setDeadlines((d) => [...d, deadline].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)));
      setToast("Deadline tracked ⏱");
    }
  }
  function skipDeadline(e: EmailRow) {
    update(e.id, { deadline_choice: "skipped" }, true);
    setToast("Okay, not tracking that one");
  }
  async function addDeadline(ev: FormEvent) {
    ev.preventDefault();
    if (!form.title.trim() || !form.date) return setToast("Add a title and a date");
    const due = new Date(`${form.date}T${form.time || "23:59"}:00+05:30`).toISOString();
    const res = await fetch("/api/deadlines", { method: "POST", body: JSON.stringify({ title: form.title.trim(), due_at: due }) });
    if (!res.ok) return setToast("Couldn't save that deadline");
    const { deadline } = await res.json();
    setDeadlines((d) => [...d, deadline].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)));
    setForm({ title: "", date: "", time: "23:59" });
    setToast("Deadline added ⏱");
  }
  async function patchDeadline(id: string, fields: Partial<Pick<DeadlineRow, "done">>) {
    setDeadlines((d) => d.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    await fetch("/api/deadlines", { method: "PATCH", body: JSON.stringify({ id, ...fields }) });
  }
  async function deleteDeadline(dl: DeadlineRow) {
    setDeadlines((d) => d.filter((x) => x.id !== dl.id));
    if (dl.email_id) setEmails((l) => l?.map((x) => (x.id === dl.email_id ? { ...x, deadline_choice: null } : x)) ?? null);
    await fetch(`/api/deadlines?id=${dl.id}`, { method: "DELETE" });
    setToast("Deadline removed");
  }
  async function bulk(ids: string[], patch: { read?: boolean; priority?: Priority; is_done?: boolean }, msg: string) {
    if (!ids.length) return;
    const set = new Set(ids);
    setEmails(
      (list) =>
        list?.map((e) =>
          set.has(e.id)
            ? { ...e, ...(patch.read !== undefined ? { unread: !patch.read } : {}), ...(patch.priority ? { priority: patch.priority, user_corrected: true } : {}), ...(patch.is_done !== undefined ? { is_done: patch.is_done } : {}) }
            : e,
        ) ?? null,
    );
    setToast(msg);
    const res = await fetch("/api/emails/bulk", { method: "POST", body: JSON.stringify({ ids, ...patch }) });
    if (!res.ok) setToast("Couldn't update Gmail. Try again");
  }
  function openReader(e: EmailRow) {
    setPop(null);
    setReaderId(e.id);
    if (e.unread) update(e.id, { read: true }, true);
  }
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("delt-theme", next);
    } catch {}
  }

  // ---------- grouping ----------
  const g = useMemo(() => {
    const raw = emails ?? [];
    // Merge repeats (reminders, replies, forwards) for the planning views; keep the newest.
    const seen = new Set<string>();
    const all = [...raw]
      .sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at))
      .filter((e) => {
        const key = cleanSubject(e.subject).toLowerCase().replace(/^(final )?reminder[:\s-]*/i, "").replace(/[^a-z0-9]/g, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const live = all.filter((e) => !e.is_done && !isPast(e, now));
    const byDeadline = (a: EmailRow, b: EmailRow) =>
      (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity) || Date.parse(b.received_at) - Date.parse(a.received_at);

    const urgent = live.filter((e) => e.priority === "very_important" && !OPPORTUNITY.has(e.category)).sort(byDeadline);
    const chances = live.filter((e) => OPPORTUNITY.has(e.category) && (e.priority === "very_important" || e.priority === "priority")).sort(byDeadline);
    const notices = live.filter((e) => e.priority === "priority" && !OPPORTUNITY.has(e.category));
    const fresh = all.filter((e) => e.unread && !e.is_done && e.priority !== "noise");
    const top = live.filter((e) => e.priority !== "noise").sort((a, b) => score(b, now) - score(a, now)).slice(0, 3);
    const prompts = live
      .filter((e) => e.deadline && e.deadline_choice == null && e.priority !== "noise" && e.priority !== "later")
      .sort(byDeadline);

    // Mail counts per day (every mail, not merged), newest day first.
    const todayKey = istDayKey(now);
    const today = raw.filter((e) => istDayKey(Date.parse(e.received_at)) === todayKey);
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const t = now - (6 - i) * 86400_000;
      const k = istDayKey(t);
      const items = raw.filter((e) => istDayKey(Date.parse(e.received_at)) === k);
      return { label: i === 6 ? "TODAY" : new Date(t).toLocaleDateString("en-IN", { weekday: "short", ...IST }).toUpperCase().slice(0, 3), total: items.length, unread: items.filter((e) => e.unread).length };
    });

    return {
      all,
      raw,
      urgent,
      chances,
      notices,
      fresh,
      top,
      prompts,
      today: { total: today.length, unread: today.filter((e) => e.unread).length },
      last7,
      unreadTotal: raw.filter((e) => e.unread).length,
    };
  }, [emails, now]);

  // Tracked + typed deadlines, upcoming first.
  const dl = useMemo(() => {
    const open = deadlines.filter((d) => !d.done);
    return {
      overdue: open.filter((d) => Date.parse(d.due_at) < now),
      upcoming: open.filter((d) => Date.parse(d.due_at) >= now),
      done: deadlines.filter((d) => d.done),
    };
  }, [deadlines, now]);

  // 7-day agenda from tracked deadlines.
  const agenda = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const t = now + i * 86400_000;
        const key = istDayKey(t);
        return {
          day: i === 0 ? "TODAY" : i === 1 ? "TMRW" : new Date(t).toLocaleDateString("en-IN", { weekday: "short", ...IST }).toUpperCase(),
          date: new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...IST }),
          items: dl.upcoming.filter((d) => istDayKey(Date.parse(d.due_at)) === key),
        };
      }),
    [dl.upcoming, now],
  );

  // Inbox: filters, then grouped by day with counts.
  const inbox = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = g.raw.filter((e) => {
      if (readFilter === "unread" && !e.unread) return false;
      if (readFilter === "read" && e.unread) return false;
      if (prioFilter === "done" ? !e.is_done : prioFilter !== "all" && (e.priority !== prioFilter || e.is_done)) return false;
      if (q && ![e.subject, e.summary, e.from_name, e.from_address].some((f) => (f ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
    const days = new Map<string, EmailRow[]>();
    for (const e of [...rows].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at))) {
      const k = istDayKey(Date.parse(e.received_at));
      days.set(k, [...(days.get(k) ?? []), e]);
    }
    return [...days.entries()].map(([k, items]) => {
      const allThatDay = g.raw.filter((e) => istDayKey(Date.parse(e.received_at)) === k);
      return { key: k, label: dayLong(items[0].received_at).toUpperCase(), items, total: allThatDay.length, unread: allThatDay.filter((e) => e.unread).length };
    });
  }, [g.raw, query, readFilter, prioFilter]);

  const byId = useMemo(() => new Map((emails ?? []).map((e) => [e.id, e])), [emails]);
  const open = openId ? byId.get(openId) ?? null : null;
  const popMail = pop ? byId.get(pop.id) ?? null : null;
  const gmailLink = (id: string, threadId?: string | null) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${threadId ?? id}`;

  // ---------- hover card placement: right, left, below, above — never on top of the mail ----------
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el || !pop) return;
    if (!pop.el.isConnected) return setPop(null);
    const r = pop.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return setPop(null);
    const w = el.offsetWidth, ph = el.offsetHeight, gap = 14, pad = 10;
    let x: number, y: number, origin: string;
    if (r.right + gap + w <= innerWidth - pad) {
      x = r.right + gap;
      y = r.top - 6;
      origin = "left top";
    } else if (r.left - gap - w >= pad) {
      x = r.left - gap - w;
      y = r.top - 6;
      origin = "right top";
    } else {
      x = Math.min(Math.max(pad, r.left), innerWidth - w - pad);
      const below = r.bottom + gap;
      y = below + ph <= innerHeight - pad ? below : r.top - gap - ph;
      origin = y > r.top ? "left top" : "left bottom";
    }
    y = Math.min(Math.max(pad, y), innerHeight - ph - pad);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transformOrigin = origin;
  }, [pop, popTick]);

  const mailProps = (e: EmailRow) => ({
    onMouseEnter: (ev: React.MouseEvent<HTMLElement>) => {
      if (!hoverable.current) return;
      const el = ev.currentTarget;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setPop({ id: e.id, el }), pop ? 40 : 120);
    },
    onMouseLeave: () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setPop(null);
    },
    onClick: () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setPop(null);
      setOpenId(e.id);
    },
  });

  function promptCard(e: EmailRow) {
    return (
      <div key={e.id} className="prompt" style={{ background: cat(e.category).fill }}>
        <button className="prompt-t" {...mailProps(e)}>
          <span className="mono prompt-k">
            {cat(e.category).label.toUpperCase()} · DUE {dayLong(e.deadline!).toUpperCase()}, {timeOf(e.deadline!)}
          </span>
          <span className="prompt-s">{cleanSubject(e.subject)}</span>
        </button>
        <div className="prompt-a">
          <span className="mono">Track this deadline?</span>
          <button className="btn gold sm" onClick={() => trackDeadline(e)}>✓ Yes</button>
          <button className="btn sm" onClick={() => skipDeadline(e)}>No</button>
        </div>
      </div>
    );
  }

  const loading = emails === null;
  // ---------- Today checklist ----------
  // Due in the next 3 days (or overdue): tracked deadlines plus urgent mail with a date.
  const needsYou = useMemo(() => {
    const horizon = now + 3 * 86400_000;
    const tracked = deadlines
      .filter((d) => !d.done && Date.parse(d.due_at) < horizon)
      .map((d) => ({
        key: `d-${d.id}`,
        title: d.title,
        due: d.due_at,
        done: () => patchDeadline(d.id, { done: true }),
        open: () => (d.email_id ? setOpenId(d.email_id) : go("deadlines")),
      }));
    const trackedMail = new Set(deadlines.map((d) => d.email_id).filter(Boolean));
    const mail = [...g.urgent, ...g.chances]
      .filter((e) => e.deadline && Date.parse(e.deadline) < horizon && !trackedMail.has(e.id))
      .map((e) => ({
        key: `m-${e.id}`,
        title: cleanSubject(e.subject),
        due: e.deadline!,
        done: () => update(e.id, { is_done: true }),
        open: () => setOpenId(e.id),
      }));
    return [...tracked, ...mail].sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlines, g.urgent, g.chances, now]);
  const unreadNotices = g.notices.filter((e) => e.unread);
  const stepsDone = [g.fresh.length === 0, g.prompts.length === 0, needsYou.length === 0, unreadNotices.length === 0].filter(Boolean).length;

  // ---------- Chances: your interests first, then soonest to close ----------
  const chanceList = useMemo(
    () =>
      g.chances
        .map((e) => ({ e, match: interestScore(`${e.subject} ${e.summary}`, interests) }))
        .sort(
          (a, b) =>
            b.match - a.match ||
            (a.e.deadline ? Date.parse(a.e.deadline) : Infinity) - (b.e.deadline ? Date.parse(b.e.deadline) : Infinity),
        ),
    [g.chances, interests],
  );
  const senders = useMemo(() => senderStats(g.raw), [g.raw]);
  const shownUnread = inbox.flatMap((d) => d.items).filter((e) => e.unread).map((e) => e.id);

  // Opening a mail counts as reading it (mirrored in Gmail).
  useEffect(() => {
    if (!openId) return;
    const m = emails?.find((e) => e.id === openId);
    if (m?.unread) update(m.id, { read: true }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
  const weekClear = clearRate(g.raw, now);

  const navBadge: Partial<Record<Tab, number>> = { new: g.fresh.length, deadlines: g.prompts.length + dl.overdue.length, chances: chanceList.filter((c) => c.match > 0 && c.e.unread).length };
  const greeting = (() => {
    const h = istHour();
    return h < 12 ? "GOOD MORNING" : h < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
  })();
  const maxBar = Math.max(1, ...g.last7.map((d) => d.total));
  const pageTitle = TABS.find((t) => t.key === tab)!.label.toUpperCase();

  // ======================= render =======================
  return (
    <div className={`wrap app ${intro ? "intro" : ""}`}>
      {/* ---------- top bar (every tab) ---------- */}
      <header className="topbar">
        <a href="#/today" className="brand" aria-label="DELT home">
          <span className="dot">DELT</span>
          <i />
        </a>
        <h1 className="dot page-title">{pageTitle}</h1>
        <div className="group">
          <button className="btn icon" onClick={sync} disabled={syncing} aria-label="Check for new mail" title="Refresh">
            <span className={syncing ? "spinning" : ""}>↻</span>
          </button>
          <button className="btn icon" onClick={toggleTheme} aria-label="Switch light or dark" title="Theme">
            ◐
          </button>
        </div>
      </header>

      {/* ======================= TODAY ======================= */}
      {tab === "today" && (
        <div className="view" key="today">
          <div className="top">
            <header className="block hero">
              <div className="eyebrow">
                {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", ...IST }).toUpperCase()} · {greeting}, {name.toUpperCase()}
              </div>
              <h1 className="dot" aria-label="DELT">
                {"DELT".split("").map((ch, i) => (
                  <span key={i} className="ltr" style={{ ["--n"]: i } as CSSProperties} aria-hidden="true">
                    {ch}
                  </span>
                ))}
                <i />
              </h1>
              <div className="tagline">DON&apos;T JUST READ MAIL. DELT WITH IT.</div>
              <div className="chips">
                {[
                  [g.fresh.length, "unread", "new"],
                  [g.prompts.length + dl.upcoming.length, "deadlines", "deadlines"],
                  [g.chances.length, "chances", "board"],
                ].map(([v, l, t], i) => (
                  <button key={l as string} className="chip" style={{ ["--n"]: i } as CSSProperties} onClick={() => go(t as Tab)}>
                    <b>{loading ? "–" : v}</b>
                    {l}
                  </button>
                ))}
              </div>
              <svg className="spark" style={{ right: 28, top: 20 }} width="54" height="54" viewBox="0 0 58 58" aria-hidden="true">
                <path d={SPARK} fill="var(--on)" />
              </svg>
              <svg className="spark b" style={{ right: 98, top: 74 }} width="26" height="26" viewBox="0 0 58 58" aria-hidden="true">
                <path d={SPARK} fill="var(--on)" />
              </svg>
            </header>

            {/* today's mail count, as asked: received / read / unread */}
            <section className="block next mailcount" aria-live="polite">
              <span className="lbl">
                <span>TODAY&apos;S MAIL</span>
                <span>{dayLong(new Date(now).toISOString()).toUpperCase()}</span>
              </span>
              <span className="mc-head">
                <span className="clock dot">{loading ? "--" : g.today.total}</span>
                <span className="clear" title="Share of this week's mail you've read or finished">
                  <span className="ring" style={{ ["--pct"]: `${weekClear}%` } as CSSProperties}>
                    <b className="dot">{weekClear}</b>
                  </span>
                  <span className="mono">% of this week
                    <br />
                    cleared</span>
                </span>
              </span>
              <span className="mc-split">
                <button onClick={() => { setReadFilter("read"); setPrioFilter("all"); go("inbox"); }}>
                  <b className="dot">{g.today.total - g.today.unread}</b> read
                </button>
                <button onClick={() => { setReadFilter("unread"); setPrioFilter("all"); go("inbox"); }}>
                  <b className="dot">{g.today.unread}</b> unread
                </button>
              </span>
              <span className="vbars" aria-label="Mail received over the last 7 days">
                {g.last7.map((d, i) => (
                  <span key={i} className="vbar" title={`${d.label}: ${d.total} mails, ${d.unread} unread`}>
                    <span className="fill" style={{ height: `${(d.total / maxBar) * 100}%` }}>
                      <span className="un" style={{ height: d.total ? `${(d.unread / d.total) * 100}%` : 0 }} />
                    </span>
                    <span className="bl">{d.label === "TODAY" ? "NOW" : d.label}</span>
                  </span>
                ))}
              </span>
            </section>
          </div>

          {/* ---------- your day: one checklist, top to bottom ---------- */}
          <h2 className="sec dot" style={{ marginTop: 30 }}>
            YOUR DAY <small className="sec-sub">{stepsDone}/4 done · work down the list</small>
          </h2>
          <ol className="steps">
            <li className={`step ${g.fresh.length === 0 ? "ok" : ""}`}>
              <span className="snum dot">{g.fresh.length === 0 ? "✓" : "1"}</span>
              <div className="sbody">
                <b>Sort what&apos;s new</b>
                <span className="mono">{g.fresh.length === 0 ? "Nothing unread. Nice." : `${g.fresh.length} unread mail${g.fresh.length === 1 ? "" : "s"} · about ${Math.max(1, Math.round(g.fresh.length / 6))} min`}</span>
              </div>
              {g.fresh.length > 0 && <button className="btn gold sm" onClick={() => go("new")}>Start →</button>}
            </li>

            <li className={`step ${g.prompts.length === 0 ? "ok" : ""}`}>
              <span className="snum dot">{g.prompts.length === 0 ? "✓" : "2"}</span>
              <div className="sbody">
                <b>Answer deadline questions</b>
                <span className="mono">{g.prompts.length === 0 ? "Every deadline answered." : "DELT found these dates. Track them?"}</span>
                {g.prompts.length > 0 && <div className="prompts" style={{ marginTop: 10 }}>{g.prompts.slice(0, 2).map(promptCard)}</div>}
                {g.prompts.length > 2 && (
                  <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go("deadlines")}>{g.prompts.length - 2} more →</button>
                )}
              </div>
            </li>

            <li className={`step ${needsYou.length === 0 ? "ok" : ""}`}>
              <span className="snum dot">{needsYou.length === 0 ? "✓" : "3"}</span>
              <div className="sbody">
                <b>Do what&apos;s due</b>
                <span className="mono">{needsYou.length === 0 ? "Nothing due in the next 3 days." : "Due in the next 3 days, soonest first"}</span>
                {needsYou.length > 0 && (
                  <div className="duelist">
                    {needsYou.map((x) => (
                      <div key={x.key} className="due">
                        <button className="check" onClick={x.done} aria-label="Mark done" />
                        <button className="dt" onClick={x.open}>
                          <span className="t">{x.title}</span>
                          <span className="d mono" style={{ color: urgencyColor(x.due, now) }}>{leftText(x.due, now)} · {dayLong(x.due)}, {timeOf(x.due)}</span>
                        </button>
                        <a className="btn sm" href={calendarLink(x.title, x.due)} target="_blank" rel="noreferrer" title="Add to Google Calendar">📅</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>

            <li className={`step ${unreadNotices.length === 0 ? "ok" : ""}`}>
              <span className="snum dot">{unreadNotices.length === 0 ? "✓" : "4"}</span>
              <div className="sbody">
                <b>Skim the notices</b>
                <span className="mono">{unreadNotices.length === 0 ? "All notices read." : `${unreadNotices.length} unread · worth knowing`}</span>
                {g.notices.length > 0 && (
                  <div className="noticelist">
                    {g.notices.slice(0, 4).map((e) => (
                      <button key={e.id} className="nrow" {...mailProps(e)}>
                        <i style={{ background: cat(e.category).fill }} />
                        <span className="t">{cleanSubject(e.subject)}</span>
                      </button>
                    ))}
                    {g.notices.length > 4 && (
                      <button className="btn sm" onClick={() => { setPrioFilter("priority"); setReadFilter("all"); go("inbox"); }}>
                        all {g.notices.length} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          </ol>
          {stepsDone === 4 && (
            <div className="deck-empty" style={{ height: 120, marginTop: 18 }}>
              <b className="dot">DAY CLEAR</b>
              <span>see what&apos;s open in Chances ✦</span>
            </div>
          )}
        </div>
      )}

      {/* ======================= NEW ======================= */}
      {tab === "new" && (
        <div className="view newview" key="new">
          <p className="lead mono">Unread mail, one card at a time. Swipe right (→) for <b>got it</b>, left (←) for <b>not for me</b>, tap to read.</p>
          <div className="deck-center">
            <SwipeDeck
              items={g.fresh}
              info={(e) => ({
                fill: cat(e.category).fill,
                label: cat(e.category).label,
                meta: e.deadline ? `due ${dayShort(e.deadline)} · ${leftText(e.deadline, now)}` : dayShort(e.received_at),
                title: cleanSubject(e.subject),
                summary: e.summary,
                from: cleanSender(e.from_name),
              })}
              onKeep={(e) => update(e.id, { read: true }, true)}
              onDismiss={(e) => {
                update(e.id, { read: true, priority: "noise" }, true);
                setToast("Moved to Noise · DELT will learn");
              }}
              onOpen={(e) => setOpenId(e.id)}
            />
          </div>
        </div>
      )}

      {/* ======================= CHANCES ======================= */}
      {tab === "chances" && (
        <div className="view" key="chances">
          <div className="filters" aria-label="Your interests">
            <span className="seg-lbl">I&apos;M INTO</span>
            {INTERESTS.map((it) => (
              <button
                key={it.key}
                className={`fchip ${interests.includes(it.key) ? "on" : ""}`}
                aria-pressed={interests.includes(it.key)}
                onClick={() => toggleInterest(it.key)}
              >
                {it.label}
              </button>
            ))}
          </div>
          <p className="hint" style={{ margin: "-6px 0 18px" }}>
            {interests.length ? "Matches for your interests come first, then soonest to close." : "Pick what you're into and matching hackathons and contests rise to the top."}
          </p>

          {chanceList.length === 0 && !loading && (
            <div className="deck-empty">
              <b className="dot">NOTHING OPEN</b>
              <span>new hackathons and contests land here</span>
            </div>
          )}
          <div className="chances">
            {chanceList.map(({ e, match }, i) => (
              <div key={e.id} className={`block chance ${match ? "match" : ""}`} style={{ background: cat(e.category).fill, ["--k"]: i } as CSSProperties}>
                <div className="ch-top mono">
                  <span className="tag">{cat(e.category).label.toUpperCase()}</span>
                  {match > 0 && <span className="pill">FOR YOU</span>}
                  {e.unread && <span className="udot" style={{ position: "static" }} />}
                </div>
                <button className="ch-title" {...mailProps(e)}>{cleanSubject(e.subject)}</button>
                <p className="ch-sum">{e.summary}</p>
                <div className="ch-foot">
                  {e.deadline ? (
                    <span className="ch-due">
                      <b className="dot">{Math.max(0, Math.floor((Date.parse(e.deadline) - now) / 86400_000))}</b>
                      <span className="mono">days left<br />{dayShort(e.deadline)}</span>
                    </span>
                  ) : (
                    <span className="mono">open now</span>
                  )}
                  <span className="ch-acts">
                    {e.deadline && (
                      <a className="btn sm" href={calendarLink(cleanSubject(e.subject), e.deadline, e.summary)} target="_blank" rel="noreferrer" title="Add to Google Calendar">📅</a>
                    )}
                    {e.deadline && e.deadline_choice !== "tracked" ? (
                      <button className="btn gold sm" onClick={() => trackDeadline(e)}>Track</button>
                    ) : (
                      <span className="mono">{e.deadline_choice === "tracked" ? "tracked ✓" : ""}</span>
                    )}
                    <button className="btn sm" onClick={() => update(e.id, { priority: "later" })} title="Not interested">✕</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================= DEADLINES ======================= */}
      {tab === "deadlines" && (
        <div className="view" key="deadlines">
          <div className="row-new">
            <section>
              <h2 className="sec dot">
                ADD ONE <small className="sec-sub">your own deadline</small>
              </h2>
              <form className="block addform" onSubmit={addDeadline}>
                <label className="fl">
                  <span className="mono">WHAT</span>
                  <input className="search" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. DSA assignment 3" maxLength={200} />
                </label>
                <div className="fl2">
                  <label className="fl">
                    <span className="mono">DATE</span>
                    <input className="search" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                  </label>
                  <label className="fl">
                    <span className="mono">TIME</span>
                    <input className="search" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
                  </label>
                </div>
                <button className="btn gold" type="submit">＋ Add deadline</button>
              </form>

              <h2 className="sec dot" style={{ marginTop: 28 }}>
                FOUND IN MAIL <small className="sec-sub">track it?</small>
              </h2>
              <div className="prompts">
                {g.prompts.map(promptCard)}
                {!loading && g.prompts.length === 0 && <p className="hint">Nothing waiting for an answer ✦</p>}
              </div>
            </section>

            <section>
              <h2 className="sec dot">
                THIS WEEK <small className="sec-sub">your tracked deadlines</small>
              </h2>
              <div className="block agenda">
                {agenda.map((d, i) => (
                  <div key={i} className={`aday ${i === 0 ? "today" : ""} ${d.items.length ? "" : "free"}`}>
                    <div className="aday-h">
                      <b className="dot">{d.day}</b>
                      <span>{d.date}</span>
                    </div>
                    <div className="aday-items">
                      {d.items.length === 0 ? (
                        <span className="afree">free</span>
                      ) : (
                        d.items.map((x) => (
                          <span key={x.id} className="achip" style={{ background: x.email_id ? cat(byId.get(x.email_id)?.category ?? "deadline").fill : "var(--gold-soft)" }}>
                            <b>{timeOf(x.due_at)}</b>
                            <span>{x.title}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="sec dot" style={{ marginTop: 28 }}>
                ALL TRACKED <small className="sec-sub">{dl.upcoming.length} upcoming · {dl.overdue.length} overdue</small>
              </h2>
              <div className="block dlist">
                {[...dl.overdue, ...dl.upcoming, ...dl.done].map((x) => {
                  const mail = x.email_id ? byId.get(x.email_id) : null;
                  const overdue = !x.done && Date.parse(x.due_at) < now;
                  return (
                    <div key={x.id} className={`drow ${x.done ? "done" : ""} ${overdue ? "overdue" : ""}`}>
                      <button className={`check ${x.done ? "on" : ""}`} onClick={() => patchDeadline(x.id, { done: !x.done })} aria-label={x.done ? "Mark not done" : "Mark done"}>
                        {x.done ? "✓" : ""}
                      </button>
                      <span className="dt">
                        <span className="t">{x.title}</span>
                        <span className="d mono">
                          {dayLong(x.due_at)} · {timeOf(x.due_at)} · {x.done ? "done" : leftText(x.due_at, now)}
                          {mail ? " · from mail" : " · yours"}
                        </span>
                      </span>
                      {mail && (
                        <button className="btn sm" onClick={() => setOpenId(mail.id)} title="Open the mail">
                          ✉
                        </button>
                      )}
                      {!x.done && (
                        <a className="btn sm" href={calendarLink(x.title, x.due_at)} target="_blank" rel="noreferrer" title="Add to Google Calendar">📅</a>
                      )}
                      <button className="btn sm" onClick={() => deleteDeadline(x)} aria-label="Remove deadline">
                        ✕
                      </button>
                    </div>
                  );
                })}
                {deadlines.length === 0 && <p className="hint" style={{ padding: 6 }}>No deadlines yet. Add one, or say yes to one found in your mail.</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ======================= INBOX ======================= */}
      {tab === "inbox" && (
        <div className="view" key="inbox">
          <div className="inbox-bar">
            <div className="seg" role="group" aria-label="View">
              <button className={inboxMode === "mail" ? "on" : ""} onClick={() => setInboxMode("mail")}>✉ Mail</button>
              <button className={inboxMode === "senders" ? "on" : ""} onClick={() => setInboxMode("senders")}>☰ Senders</button>
            </div>
            {inboxMode === "mail" && <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, sender, summary…" />}
            {inboxMode === "mail" && <div className="seg" role="group" aria-label="Read state">
              {(["all", "unread", "read"] as const).map((r) => (
                <button key={r} className={readFilter === r ? "on" : ""} onClick={() => setReadFilter(r)}>
                  {r === "all" ? "All" : r === "unread" ? `Unread ${g.unreadTotal}` : "Read"}
                </button>
              ))}
            </div>}
            {inboxMode === "mail" && <div className="seg" role="group" aria-label="Priority">
              {(["all", ...PRIO_KEYS, "done"] as const).map((p) => (
                <button key={p} className={prioFilter === p ? "on" : ""} onClick={() => setPrioFilter(p)}>
                  {p === "all" ? "Any" : p === "done" ? "Done" : PRIO[p].label}
                </button>
              ))}
            </div>}
            {inboxMode === "mail" && shownUnread.length > 0 && (
              <button className="btn sm" onClick={() => bulk(shownUnread, { read: true }, `Marked ${shownUnread.length} read`)}>✓ Mark {shownUnread.length} read</button>
            )}
          </div>

          {inboxMode === "senders" && (
            <section className="block senders">
              <p className="hint" style={{ margin: "2px 4px 12px" }}>
                Who mails you most. Moving a sender here also teaches DELT where their future mail goes.
              </p>
              {senders.slice(0, 40).map((s) => (
                <div key={s.address} className="srow2">
                  <span className="av dot">{initials(s.name)}</span>
                  <span className="sinfo">
                    <span className="t">{s.name}</span>
                    <span className="d mono">
                      {s.total} mail{s.total === 1 ? "" : "s"} · {s.unread} unread · {s.address}
                    </span>
                  </span>
                  <span className="sacts">
                    {s.unread > 0 && (
                      <button className="btn sm" onClick={() => bulk(s.ids, { read: true }, `Marked ${s.unread} read`)} title="Mark all read">
                        ✓ read
                      </button>
                    )}
                    <button className="btn sm" onClick={() => bulk(s.ids, { priority: "later" }, `${s.name} → Later from now on`)} title="Always Later">
                      Later
                    </button>
                    <button className="btn sm" onClick={() => bulk(s.ids, { priority: "noise", read: true }, `${s.name} muted`)} title="Mute: always Noise">
                      Mute
                    </button>
                  </span>
                </div>
              ))}
            </section>
          )}

          {inboxMode === "mail" && inbox.map((day) => (
            <section key={day.key} className="iday">
              <h2 className="iday-h">
                <b className="dot">{day.label}</b>
                <span className="mono">
                  {day.total} mail{day.total === 1 ? "" : "s"} · {day.total - day.unread} read · {day.unread} unread
                </span>
              </h2>
              <div className="block ilist">
                {day.items.map((e) => (
                  <div key={e.id} className={`irow ${e.unread ? "unread" : ""} ${e.is_done ? "isdone" : ""}`}>
                    <button className={`rdot ${e.unread ? "on" : ""}`} onClick={() => update(e.id, { read: e.unread })} title={e.unread ? "Mark read" : "Mark unread"} aria-label={e.unread ? "Mark read" : "Mark unread"} />
                    <button className="it" {...mailProps(e)}>
                      <span className="t">{cleanSubject(e.subject)}</span>
                      <span className="s">
                        {cleanSender(e.from_name)} · {timeOf(e.received_at)}
                      </span>
                    </button>
                    <div className="picks">
                    <select className="pick" value={e.category} onChange={(ev) => update(e.id, { category: ev.target.value as EmailRow["category"] })} aria-label="Category" style={{ background: cat(e.category).fill }}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {cat(c).label}
                        </option>
                      ))}
                    </select>
                    <select className="pick" value={e.priority} onChange={(ev) => update(e.id, { priority: ev.target.value as Priority })} aria-label="Priority" style={{ background: PRIO[e.priority].fill }}>
                      {PRIO_KEYS.map((p) => (
                        <option key={p} value={p}>
                          {PRIO[p].label}
                        </option>
                      ))}
                    </select>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {inboxMode === "mail" && !loading && inbox.length === 0 && <div className="deck-empty"><b className="dot">NOTHING</b><span>no mail matches these filters</span></div>}
        </div>
      )}

      <footer>
        {email} ·{" "}
        <form action={signOutAction} style={{ display: "inline" }}>
          <button style={{ textDecoration: "underline" }}>sign out</button>
        </form>
        <br />
        Labels also appear in Gmail under MailSort · if something looks off, trust the original mail.
      </footer>

      {/* ---------- bottom tab bar (like the FFCS planner) ---------- */}
      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.key} href={`#/${t.key}`} className={`nav-item ${tab === t.key ? "active" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => window.scrollTo({ top: 0 })}>
            <span className="npill">
              <Icon d={t.icon} />
              {!!navBadge[t.key] && <span className="nbadge">{navBadge[t.key]}</span>}
            </span>
            {t.label}
          </a>
        ))}
      </nav>

      {/* ---------- hover card ---------- */}
      <div ref={popRef} className={`pop ${popMail ? "show" : ""}`} role="tooltip" style={{ background: popMail ? cat(popMail.category).fill : "var(--gold)" }}>
        {popMail && (
          <>
            <div className="code">
              {cat(popMail.category).label.toUpperCase()} · {PRIO[popMail.priority].label.toUpperCase()} · {popMail.unread ? "UNREAD" : "READ"}
            </div>
            <h3>{cleanSubject(popMail.subject)}</h3>
            <div className="from">
              <span className="av">{initials(cleanSender(popMail.from_name))}</span>
              <div>
                {cleanSender(popMail.from_name)}
                <small>Received {dayLong(popMail.received_at)}</small>
              </div>
            </div>
            <p>{popMail.summary}</p>
            <dl>
              {popMail.deadline && (
                <>
                  <dt>DUE</dt>
                  <dd>
                    {dayLong(popMail.deadline)}, {timeOf(popMail.deadline)}
                  </dd>
                  <dt>LEFT</dt>
                  <dd>{leftText(popMail.deadline, now)}</dd>
                </>
              )}
              <dt>WHY</dt>
              <dd>{popMail.user_corrected ? "You placed it" : popMail.reason}</dd>
            </dl>
          </>
        )}
      </div>

      {/* ---------- detail drawer ---------- */}
      {open && (
        <>
          <div className="veil" style={{ zIndex: 62 }} onClick={() => setOpenId(null)} />
          <aside className="sheet" style={{ zIndex: 63 }} role="dialog" aria-modal="true" aria-label={cleanSubject(open.subject)}>
            <div className="block" style={{ background: cat(open.category).fill, color: "var(--on)" }}>
              <div className="flex items-start justify-between gap-3">
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: ".06em" }}>
                  {cat(open.category).label.toUpperCase()} · {PRIO[open.priority].label.toUpperCase()} · {open.unread ? "UNREAD" : "READ"}
                </span>
                <button className="btn sm" onClick={() => setOpenId(null)} aria-label="Close">
                  ✕
                </button>
              </div>
              <h2 style={{ fontSize: 28, lineHeight: 1.1, margin: "10px 0 14px", fontWeight: 700 }}>{cleanSubject(open.subject)}</h2>
              <div className="pop inline">
                <div className="from">
                  <span className="av">{initials(cleanSender(open.from_name))}</span>
                  <div>
                    {cleanSender(open.from_name)}
                    <small>Received {dayLong(open.received_at)}</small>
                  </div>
                </div>
                <p style={{ fontSize: 16 }}>{open.summary}</p>
                {open.deadline && (
                  <dl>
                    <dt>DUE</dt>
                    <dd>
                      {dayLong(open.deadline)}, {timeOf(open.deadline)}
                    </dd>
                    <dt>LEFT</dt>
                    <dd>{leftText(open.deadline, now)}</dd>
                  </dl>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-5">
                <button className="btn gold" onClick={() => openReader(open)}>
                  📖 Read full mail
                </button>
                <button className="btn" onClick={() => update(open.id, { read: open.unread })}>
                  {open.unread ? "● Mark read" : "○ Mark unread"}
                </button>
                <button className="btn" onClick={() => update(open.id, { is_done: !open.is_done })}>
                  {open.is_done ? "↺ Undo" : "✓ Done"}
                </button>
              </div>
              {open.deadline && Date.parse(open.deadline) > now && open.deadline_choice !== "tracked" && (
                <div className="prompt-a" style={{ marginTop: 14 }}>
                  <span className="mono">Track this deadline?</span>
                  <button className="btn gold sm" onClick={() => trackDeadline(open)}>✓ Yes</button>
                  {open.deadline_choice !== "skipped" && <button className="btn sm" onClick={() => skipDeadline(open)}>No</button>}
                </div>
              )}
              <div className="mono mt-6 mb-2" style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7, letterSpacing: ".06em" }}>
                MOVE TO
              </div>
              <div className="movegrid">
                {PRIO_KEYS.map((p) => (
                  <button key={p} className={`mv ${open.priority === p ? "on" : ""}`} style={{ background: PRIO[p].fill }} onClick={() => update(open.id, { priority: p })}>
                    {PRIO[p].label}
                  </button>
                ))}
              </div>
              <div className="mono mt-4 mb-2" style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7, letterSpacing: ".06em" }}>
                CATEGORY
              </div>
              <select className="pick wide" value={open.category} onChange={(ev) => update(open.id, { category: ev.target.value as EmailRow["category"] })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {cat(c).label}
                  </option>
                ))}
              </select>
              <p className="mono mt-4" style={{ fontSize: 11.5, opacity: 0.7 }}>
                {open.user_corrected ? "Placed by you — similar mail will follow." : `${open.sorted_by === "ai" ? "AI" : "Rules"}: ${open.reason ?? ""}`}
              </p>
            </div>
          </aside>
        </>
      )}

      {readerId && <MailReader id={readerId} gmailLink={gmailLink(readerId, byId.get(readerId)?.thread_id)} onClose={() => setReaderId(null)} />}

      {toast && (
        <div className="block toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
