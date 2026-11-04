"use client";

// DELT v2: one inbox with every mail (colour tag = pile), and a Deadlines tab.
// Tap a mail to read it full screen. Swipe right = read/unread, left = done.
// See docs/DESIGN.md for why it works this way.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { EmailRow, Priority } from "@/lib/supabase";
import {
  PILES, BUCKETS, ago, cleanSender, cleanSubject, deadlineBuckets, dueLevel, dueText, filterMail, groupByDay, initials, openDeadlines, pileCounts, pileLabel, shortTime,
} from "@/lib/inbox";
import { calendarLink } from "@/lib/insights";
import MailView from "./mail-view";
import Appearance from "./appearance";

type Route = { tab: "inbox" | "deadlines"; mailId: string | null };
const SYNC_EVERY = 5 * 60_000;

function readRoute(): Route {
  const h = typeof location === "undefined" ? "" : location.hash;
  const m = h.match(/^#\/mail\/(.+)$/);
  if (m) return { tab: (sessionStorage.getItem("delt-tab") as Route["tab"]) || "inbox", mailId: decodeURIComponent(m[1]) };
  return { tab: h.startsWith("#/deadlines") ? "deadlines" : "inbox", mailId: null };
}

export default function InboxApp({ email, name, signOutAction }: { email: string; name: string; signOutAction: () => Promise<void> }) {
  const [mails, setMails] = useState<EmailRow[] | null>(null);
  const [route, setRoute] = useState<Route>({ tab: "inbox", mailId: null });
  const [pile, setPile] = useState<Priority | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [menu, setMenu] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // ---------- routing (hash, so the phone's Back button closes a mail) ----------
  useEffect(() => {
    const on = () => setRoute(readRoute());
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const goTab = (tab: Route["tab"]) => {
    sessionStorage.setItem("delt-tab", tab);
    location.hash = `#/${tab}`;
    window.scrollTo({ top: 0 });
  };
  const openMail = (m: EmailRow) => {
    sessionStorage.setItem("delt-tab", route.tab);
    location.hash = `#/mail/${encodeURIComponent(m.id)}`;
    if (m.unread) patch(m.id, { read: true }, true);
  };
  const closeMail = () => (history.length > 1 && route.mailId ? history.back() : (location.hash = `#/${route.tab}`));

  // ---------- data + sync ----------
  const load = useCallback(async () => {
    const r = await fetch("/api/emails?days=60");
    if (r.ok) setMails((await r.json()).emails ?? []);
    else if (r.status === 401) location.reload();
  }, []);
  const syncing$ = useRef(false);
  const sync = useCallback(
    async (loud = false) => {
      if (syncing$.current) return;
      syncing$.current = true;
      setSyncing(true);
      try {
        const r = await fetch("/api/sync", { method: "POST" });
        const d = await r.json().catch(() => ({}));
        await load();
        setSyncedAt(Date.now());
        if (loud || d.fetched > 0) setToast({ text: d.fetched > 0 ? `${d.fetched} new mail${d.fetched > 1 ? "s" : ""}` : "You're up to date" });
      } catch {
        if (loud) setToast({ text: "Couldn't reach Gmail. Try again" });
      }
      syncing$.current = false;
      setSyncing(false);
    },
    [load],
  );
  useEffect(() => {
    load().then(() => sync());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const auto = setInterval(() => document.visibilityState === "visible" && sync(), SYNC_EVERY);
    const back = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      setSyncedAt((t) => {
        if (!t || Date.now() - t > 2 * 60_000) sync();
        return t;
      });
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(tick);
      clearInterval(auto);
      document.removeEventListener("visibilitychange", back);
    };
  }, [load, sync]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- actions (instant on screen, then saved + mirrored to Gmail) ----------
  type Patch = { read?: boolean; is_done?: boolean; priority?: Priority };
  function patch(id: string, p: Patch, quiet = false) {
    const before = mails?.find((m) => m.id === id);
    setMails((l) => l?.map((m) => (m.id === id ? apply(m, p) : m)) ?? null);
    fetch("/api/emails", { method: "PATCH", body: JSON.stringify({ id, ...p }) }).then((r) => !r.ok && setToast({ text: "Couldn't save. Check your connection" }));
    if (quiet || !before) return;
    const undo = () => patch(id, { read: p.read !== undefined ? !before.unread : undefined, is_done: p.is_done !== undefined ? before.is_done : undefined, priority: p.priority ? before.priority : undefined }, true);
    const text =
      p.priority ? `Moved to ${pileLabel(p.priority)}. DELT will remember this sender` : p.is_done !== undefined ? (p.is_done ? "Marked done" : "Not done") : p.read ? "Marked read" : "Marked unread";
    setToast({ text, undo });
  }
  async function markAllRead(ids: string[]) {
    const set = new Set(ids);
    setMails((l) => l?.map((m) => (set.has(m.id) ? { ...m, unread: false } : m)) ?? null);
    setToast({ text: `${ids.length} marked read` });
    const r = await fetch("/api/emails/bulk", { method: "POST", body: JSON.stringify({ ids, read: true }) });
    if (!r.ok) setToast({ text: "Couldn't update Gmail. Try again" });
  }

  // ---------- derived ----------
  const all = useMemo(() => mails ?? [], [mails]);
  const counts = useMemo(() => pileCounts(all), [all]);
  const shown = useMemo(() => filterMail(all, { pile, unreadOnly, query }), [all, pile, unreadOnly, query]);
  const days = useMemo(() => groupByDay(shown, now), [shown, now]);
  const buckets = useMemo(() => deadlineBuckets(all, now), [all, now]);
  const dueCount = openDeadlines(buckets);
  const open = route.mailId ? all.find((m) => m.id === route.mailId) ?? null : null;
  const unreadShown = shown.filter((m) => m.unread).map((m) => m.id);
  const gmailLink = (m: EmailRow) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${m.thread_id ?? m.id}`;

  return (
    <div className="shell">
      {/* ---------- top bar ---------- */}
      <header className="appbar">
        <a href="#/inbox" className="logo" onClick={() => goTab("inbox")} aria-label="DELT inbox">
          <span>DELT</span>
          <i />
        </a>
        <button className="sync" onClick={() => sync(true)} disabled={syncing} title="Check for new mail">
          <span className={syncing ? "spin" : ""} aria-hidden="true">↻</span>
          <span>{syncing ? "Checking…" : syncedAt ? `Updated ${ago(syncedAt, now)}` : "Sync"}</span>
        </button>
        <div className="appbar-r">
          <Appearance />
          <div className="acct">
            <button className="avatar me" onClick={() => setMenu((m) => !m)} aria-label="Account" aria-expanded={menu}>
              {initials(name)}
            </button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <div className="menu-who">
                  <b>{name}</b>
                  <small>{email}</small>
                </div>
                <a className="menu-item" href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`} target="_blank" rel="noreferrer">
                  Open Gmail ↗
                </a>
                <form action={signOutAction}>
                  <button className="menu-item">Sign out</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================= INBOX ======================= */}
      {route.tab === "inbox" && (
        <main className="page" key="inbox">
          <div className="searchbar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 5 5" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" aria-label="Search mail" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search">✕</button>}
          </div>

          <nav className="chips" aria-label="Filter by pile">
            {(["all", ...PILES.map((p) => p.key)] as const).map((k) => (
              <button key={k} className={`fchip p-${k} ${pile === k ? "on" : ""}`} onClick={() => setPile(k)} aria-pressed={pile === k}>
                {k !== "all" && <i className="tagdot" />}
                {k === "all" ? "All" : pileLabel(k)}
                <span className="n">{counts[k].total}</span>
              </button>
            ))}
          </nav>

          <div className="listbar">
            <label className="toggle">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              <span className="knob" aria-hidden="true" />
              Unread only <span className="muted">({counts[pile].unread})</span>
            </label>
            {unreadShown.length > 0 && (
              <button className="link" onClick={() => markAllRead(unreadShown)}>
                Mark all read
              </button>
            )}
          </div>

          {mails === null ? (
            <Skeleton />
          ) : shown.length === 0 ? (
            <Empty
              title={query ? "No mail matches that search" : unreadOnly ? "All read here" : "Nothing in this pile"}
              hint={query ? "Try a sender's name or a word from the subject." : "Switch to All to see every mail."}
            />
          ) : (
            days.map((d) => (
              <section key={d.key} className="day">
                <h2 className="dayhead">
                  {d.label}
                  <span className="muted">
                    {d.mails.length} · {d.mails.filter((m) => m.unread).length} unread
                  </span>
                </h2>
                <ul className="rows">
                  {d.mails.map((m) => (
                    <MailRow key={m.id} m={m} now={now} onOpen={() => openMail(m)} onRead={() => patch(m.id, { read: m.unread })} onDone={() => patch(m.id, { is_done: !m.is_done })} />
                  ))}
                </ul>
              </section>
            ))
          )}
          <p className="foot muted">Showing the last 60 days · swipe right to mark read, left to mark done</p>
        </main>
      )}

      {/* ======================= DEADLINES ======================= */}
      {route.tab === "deadlines" && (
        <main className="page" key="deadlines">
          <div className="pagehead">
            <h1>Deadlines</h1>
            <p className="muted">Found in your mail automatically. Tap one to read the mail.</p>
          </div>
          {mails === null ? (
            <Skeleton />
          ) : BUCKETS.every((b) => buckets[b].length === 0) ? (
            <Empty title="No deadlines in your mail" hint="When a mail mentions a due date, it shows up here." />
          ) : (
            BUCKETS.filter((b) => buckets[b].length > 0).map((b) => (
              <section key={b} className={`day bucket b-${b.replace(" ", "")}`}>
                <h2 className="dayhead">
                  {b}
                  <span className="muted">{buckets[b].length}</span>
                  {b === "Done" && (
                    <button className="link" onClick={() => setShowDone((s) => !s)}>
                      {showDone ? "Hide" : "Show"}
                    </button>
                  )}
                </h2>
                {(b !== "Done" || showDone) && (
                  <ul className="rows">
                    {buckets[b].map((m) => (
                      <li key={m.id} className={`row due-row ${m.is_done ? "done" : ""}`}>
                        <button className="row-main" onClick={() => openMail(m)}>
                          <span className={`datebox lv-${dueLevel(m.deadline!, now)}`}>
                            <b>{new Date(m.deadline!).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</b>
                            <small>{new Date(m.deadline!).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</small>
                          </span>
                          <span className="row-text">
                            <span className="subj">{cleanSubject(m.subject)}</span>
                            <span className="meta">
                              <span className={`due lv-${dueLevel(m.deadline!, now)}`}>{dueText(m.deadline!, now)}</span>
                              <span className={`tag p-${m.priority}`}>{pileLabel(m.priority)}</span>
                              <span className="muted ell">{cleanSender(m.from_name)}</span>
                            </span>
                          </span>
                        </button>
                        <div className="row-acts">
                          <a className="iconbtn" href={calendarLink(cleanSubject(m.subject), m.deadline!, m.summary)} target="_blank" rel="noreferrer" title="Add to Google Calendar" aria-label="Add to Google Calendar">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4m8-4v4" /></svg>
                          </a>
                          <button className={`iconbtn check ${m.is_done ? "on" : ""}`} onClick={() => patch(m.id, { is_done: !m.is_done })} aria-label={m.is_done ? "Mark not done" : "Mark done"} title="Done">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </main>
      )}

      {/* ---------- bottom tabs ---------- */}
      <nav className="tabbar" aria-label="Sections">
        <button className={route.tab === "inbox" ? "on" : ""} onClick={() => goTab("inbox")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z" /></svg>
          Inbox
          {counts.all.unread > 0 && <span className="badge">{counts.all.unread > 99 ? "99+" : counts.all.unread}</span>}
        </button>
        <button className={route.tab === "deadlines" ? "on" : ""} onClick={() => goTab("deadlines")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          Deadlines
          {dueCount > 0 && <span className="badge">{dueCount}</span>}
        </button>
      </nav>

      {/* ---------- full-screen mail ---------- */}
      {route.mailId && (
        <MailView
          id={route.mailId}
          row={open}
          now={now}
          gmailLink={open ? gmailLink(open) : `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`}
          onClose={closeMail}
          onPatch={(p) => patch(route.mailId!, p)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function apply(m: EmailRow, p: { read?: boolean; is_done?: boolean; priority?: Priority }): EmailRow {
  return {
    ...m,
    ...(p.read !== undefined ? { unread: !p.read } : {}),
    ...(p.is_done !== undefined ? { is_done: p.is_done } : {}),
    ...(p.priority ? { priority: p.priority, user_corrected: true } : {}),
  };
}

// ---------- one mail row: tap to open, swipe to act ----------
function MailRow({ m, now, onOpen, onRead, onDone }: { m: EmailRow; now: number; onOpen: () => void; onRead: () => void; onDone: () => void }) {
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; on: boolean; moved: boolean; dx: number } | null>(null);
  const moved = useRef(false);
  const LIMIT = 84;

  const down = (e: RPointerEvent) => {
    if (e.pointerType === "mouse") return; // desktop uses the hover buttons
    drag.current = { x: e.clientX, y: e.clientY, on: false, moved: false, dx: 0 };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = e.clientX - d.x, y = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) return void (drag.current = null); // a scroll
      if (Math.abs(x) < 10) return;
      d.on = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    d.moved = true;
    d.dx = Math.max(-140, Math.min(140, x));
    setDx(d.dx);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.on) {
      if (d.dx > LIMIT) onRead();
      else if (d.dx < -LIMIT) onDone();
    }
    setDx(0);
    if (d?.moved) {
      moved.current = true; // swallow the click that follows a swipe
      setTimeout(() => (moved.current = false), 0);
    }
  };
  const sender = cleanSender(m.from_name);

  return (
    <li className={`row ${m.unread ? "unread" : ""} ${m.is_done ? "done" : ""} ${dx ? "dragging" : ""}`}>
      <div className={`swipe-bg ${dx > 0 ? "r" : "l"} ${Math.abs(dx) > LIMIT ? "armed" : ""}`} aria-hidden="true">
        <span>{dx > 0 ? (m.unread ? "Read" : "Unread") : m.is_done ? "Not done" : "Done"}</span>
      </div>
      <div className="row-slide" style={{ transform: dx ? `translateX(${dx}px)` : undefined }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button className="row-main" onClick={() => !moved.current && onOpen()}>
          <span className={`avatar p-${m.priority}`} aria-hidden="true">
            {initials(sender)}
          </span>
          <span className="row-text">
            <span className="line1">
              <i className={`tagdot pdot p-${m.priority}`} title={pileLabel(m.priority)} aria-hidden="true" />
              <span className="from ell">{sender}</span>
              <span className="time">{shortTime(m.received_at, now)}</span>
            </span>
            <span className="subj ell">{cleanSubject(m.subject)}</span>
            <span className="sum ell">{m.summary || m.snippet}</span>
            <span className="meta">
              <span className={`tag p-${m.priority}`}>
                <i className="tagdot" />
                {pileLabel(m.priority)}
              </span>
              {m.deadline && !m.is_done && <span className={`due lv-${dueLevel(m.deadline, now)}`}>Due {dueText(m.deadline, now)}</span>}
              {m.is_done && <span className="donemark">✓ Done</span>}
            </span>
          </span>
        </button>
        <div className="row-acts hover-only">
          <button className="iconbtn" onClick={onRead} title={m.unread ? "Mark read" : "Mark unread"} aria-label={m.unread ? "Mark read" : "Mark unread"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{m.unread ? <path d="M4 6h16v12H4zM4 7l8 6 8-6" /> : <path d="M4 10l8-6 8 6v9H4zM4 10l8 5 8-5" />}</svg>
          </button>
          <button className={`iconbtn check ${m.is_done ? "on" : ""}`} onClick={onDone} title={m.is_done ? "Mark not done" : "Mark done"} aria-label={m.is_done ? "Mark not done" : "Mark done"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
          </button>
        </div>
        {m.unread && <i className="unread-dot" aria-label="Unread" />}
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <ul className="rows skeleton" aria-label="Loading mail">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="row">
          <div className="row-main">
            <span className="avatar sk" />
            <span className="row-text">
              <span className="sk" style={{ width: "40%" }} />
              <span className="sk" style={{ width: "85%" }} />
              <span className="sk" style={{ width: "65%" }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      <span className="muted">{hint}</span>
    </div>
  );
}
