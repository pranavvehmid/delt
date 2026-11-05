"use client";

// DELT v2: one inbox with every mail (colour tag = pile), and a Deadlines tab.
// Tap a mail to read it full screen. Swipe right = read/unread, left = done.
// See docs/DESIGN.md for why it works this way.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { EmailRow, Priority } from "@/lib/supabase";
import {
  PAGE_SIZE, PILES, BUCKETS, ago, cleanSender, cleanSubject, deadlineBuckets, dueLevel, dueText, filterMail, groupByDay, initials, mergeFresh, mergeMore, oldestReceived,
  openDeadlines, pileCounts, pileLabel, shortTime,
} from "@/lib/inbox";
import { calendarLink } from "@/lib/insights";
import { cacheKey, clearOffline, packCache, unpackCache } from "@/lib/offline";
import MailView from "./mail-view";
import Appearance from "./appearance";
import Settings from "./settings";

type Route = { tab: "inbox" | "deadlines"; mailId: string | null };
const SYNC_EVERY = 5 * 60_000;

function readRoute(): Route {
  const h = typeof location === "undefined" ? "" : location.hash;
  const m = h.match(/^#\/mail\/(.+)$/);
  if (m) return { tab: (sessionStorage.getItem("delt-tab") as Route["tab"]) || "inbox", mailId: decodeURIComponent(m[1]) };
  return { tab: h.startsWith("#/deadlines") ? "deadlines" : "inbox", mailId: null };
}

type Props = { email: string; name: string; signOutAction: () => Promise<void>; signInAction?: () => Promise<void> };

export default function InboxApp({ email, name, signOutAction, signInAction }: Props) {
  // mails: newest pages, loaded as you scroll. hits: server search results. due: mail with a
  // deadline, however old, so the Deadlines tab doesn't depend on how far you scrolled.
  const [mails, setMails] = useState<EmailRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hits, setHits] = useState<EmailRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [due, setDue] = useState<EmailRow[]>([]);
  const [reauth, setReauth] = useState(false);
  // Offline (issue #14): the last inbox saved on this phone, and when it was saved.
  const [offline, setOffline] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [settingsSection, setSettingsSection] = useState<"data" | "rules" | undefined>();
  const [route, setRoute] = useState<Route>({ tab: "inbox", mailId: null });
  const [pile, setPile] = useState<Priority | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [menu, setMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const openedFrom = useRef<string | null>(null);
  const openMail = (m: EmailRow) => {
    openedFrom.current = m.id;
    sessionStorage.setItem("delt-tab", route.tab);
    location.hash = `#/mail/${encodeURIComponent(m.id)}`;
    if (m.unread) patch(m.id, { read: true }, true);
  };
  const closeMail = () => (history.length > 1 && route.mailId ? history.back() : (location.hash = `#/${route.tab}`));

  // ---------- data + sync ----------
  const mailsRef = useRef<EmailRow[] | null>(null);
  mailsRef.current = mails;
  const pagedOlder = useRef(false);
  const load = useCallback(async () => {
    let r: Response, d: Response;
    try {
      [r, d] = await Promise.all([fetch(`/api/emails?limit=${PAGE_SIZE}`), fetch("/api/emails?due=1&limit=300")]);
    } catch {
      setOffline(true); // no connection: keep showing the saved inbox
      return false;
    }
    if (r.status === 401) {
      location.reload();
      return false;
    }
    setOffline(false);
    if (r.ok) {
      const j = await r.json();
      const page: EmailRow[] = j.emails ?? [];
      setMails((l) => (l && pagedOlder.current ? mergeFresh(l, page, j.more) : page));
      if (!pagedOlder.current || !j.more) setMore(!!j.more);
      if (!j.more) pagedOlder.current = false;
      setReauth(!!j.reauth);
    }
    if (d.ok) setDue((await d.json()).emails ?? []);
    if (r.ok) setSavedAt(Date.now());
    return r.ok;
  }, []);
  // Scrolling near the end loads the next older page (issue #11).
  const olderBusy = useRef(false);
  const loadOlder = useCallback(async () => {
    const cursor = oldestReceived(mailsRef.current ?? []);
    if (olderBusy.current || !cursor) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    try {
      const r = await fetch(`/api/emails?before=${encodeURIComponent(cursor)}&limit=${PAGE_SIZE}`);
      if (r.ok) {
        const j = await r.json();
        const page: EmailRow[] = j.emails ?? [];
        const have = new Set((mailsRef.current ?? []).map((m) => m.id));
        const added = page.filter((m) => !have.has(m.id)).length;
        pagedOlder.current = true;
        setMails((l) => mergeMore(l ?? [], page));
        setMore(!!j.more && added > 0);
      }
    } finally {
      olderBusy.current = false;
      setLoadingOlder(false);
    }
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
        if (d.reauth) setReauth(true);
        if (!(await load())) throw new Error("offline");
        setSyncedAt(Date.now());
        if (!d.reauth && (loud || d.fetched > 0)) setToast({ text: d.fetched > 0 ? `${d.fetched} new mail${d.fetched > 1 ? "s" : ""}` : "No new mail" });
      } catch {
        if (!navigator.onLine) setOffline(true);
        if (loud) setToast({ text: navigator.onLine ? "Couldn't reach Gmail" : "You're offline" });
      }
      syncing$.current = false;
      setSyncing(false);
    },
    [load],
  );
  // Show the saved inbox at once, then fetch the real one.
  useEffect(() => {
    try {
      const c = unpackCache<EmailRow>(localStorage.getItem(cacheKey(email)), Date.now());
      if (c) {
        setMails((l) => l ?? c.mails);
        setDue((l) => (l.length ? l : c.due));
        setSavedAt(c.at);
      }
    } catch {}
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, [email]);
  // Keep the saved copy up to date with what's on screen (read, done, moved).
  useEffect(() => {
    if (!mails || offline) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(cacheKey(email), packCache(mails, due, savedAt ?? Date.now()));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [mails, due, offline, savedAt, email]);
  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => {
      setOffline(false);
      load().then((ok) => {
      if (ok) sync();
    });
    };
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [load, sync]);

  useEffect(() => {
    load().then((ok) => {
      if (ok) sync();
    });
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

  // Search covers all stored mail on the server, not only the loaded pages (issue #11).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/emails?q=${encodeURIComponent(q)}&limit=200`);
        if (alive && r.ok) setHits((await r.json()).emails ?? []);
      } catch {}
      if (alive) setSearching(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  // ---------- actions (instant on screen, then saved + mirrored to Gmail) ----------
  const findMail = (id: string) => mails?.find((m) => m.id === id) ?? hits?.find((m) => m.id === id) ?? due.find((m) => m.id === id) ?? null;
  const updateAll = (fn: (m: EmailRow) => EmailRow) => {
    setMails((l) => l?.map(fn) ?? null);
    setHits((l) => l?.map(fn) ?? null);
    setDue((l) => l.map(fn));
  };
  type Patch = { read?: boolean; is_done?: boolean; priority?: Priority };
  const blockedOffline = () => {
    if (!offline) return false;
    setToast({ text: "You're offline. Changes are paused until you're back online." });
    return true;
  };
  function patch(id: string, p: Patch, quiet = false) {
    if (blockedOffline()) return;
    const before = findMail(id);
    updateAll((m) => (m.id === id ? apply(m, p) : m));
    fetch("/api/emails", { method: "PATCH", body: JSON.stringify({ id, ...p }) }).then((r) => !r.ok && setToast({ text: "Couldn't save that change" }));
    if (quiet || !before) return;
    const undo = () => patch(id, { read: p.read !== undefined ? !before.unread : undefined, is_done: p.is_done !== undefined ? before.is_done : undefined, priority: p.priority ? before.priority : undefined }, true);
    const text =
      p.priority ? `Moved to ${pileLabel(p.priority)}` : p.is_done !== undefined ? (p.is_done ? "Marked done" : "Not done") : p.read ? "Marked read" : "Marked unread";
    setToast({ text, undo });
  }
  async function markAllRead(ids: string[]) {
    if (blockedOffline()) return;
    const set = new Set(ids);
    updateAll((m) => (set.has(m.id) ? { ...m, unread: false } : m));
    setToast({ text: `${ids.length} marked read` });
    const r = await fetch("/api/emails/bulk", { method: "POST", body: JSON.stringify({ ids, read: true }) });
    if (!r.ok) setToast({ text: "Couldn't update Gmail" });
  }

  // ---------- derived ----------
  const all = useMemo(() => mails ?? [], [mails]);
  const counts = useMemo(() => pileCounts(all), [all]);
  const searchable = useMemo(() => (hits ? mergeMore(all, hits) : all), [all, hits]);
  const shown = useMemo(() => filterMail(searchable, { pile, unreadOnly, query }), [searchable, pile, unreadOnly, query]);
  const days = useMemo(() => groupByDay(shown, now), [shown, now]);
  const buckets = useMemo(() => deadlineBuckets(mergeMore(all, due), now), [all, due, now]);
  const dueCount = openDeadlines(buckets);
  const open = route.mailId ? findMail(route.mailId) : null;

  // load the next page when the end of the list comes near
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoadOlder = route.tab === "inbox" && !query.trim() && more && mails !== null;
  useEffect(() => {
    const el = sentinel.current;
    if (!canLoadOlder || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadOlder(), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadOlder, loadOlder, mails?.length]);

  // account menu: Esc or a click/tab outside closes it (issue #8)
  const acct = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    acct.current?.querySelector<HTMLElement>(".menu-item")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      acct.current?.querySelector<HTMLElement>(".avatar")?.focus();
    };
    const out = (e: Event) => !acct.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", out);
    document.addEventListener("focusin", out);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", out);
      document.removeEventListener("focusin", out);
    };
  }, [menu]);
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
          <div className="acct" ref={acct}>
            <button className="avatar me" onClick={() => setMenu((m) => !m)} aria-label="Account" aria-expanded={menu} aria-controls="acct-menu">
              {initials(name)}
            </button>
            {menu && (
              <div className="menu" id="acct-menu">
                <div className="menu-who">
                  <b>{name}</b>
                  <small>{email}</small>
                </div>
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    setSettingsSection(undefined);
                    setSettingsOpen(true);
                  }}
                >
                  Settings
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    setSettingsSection("rules");
                    setSettingsOpen(true);
                  }}
                >
                  Sorting rules
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    setSettingsSection("data");
                    setSettingsOpen(true);
                  }}
                >
                  Delete my data
                </button>
                <a className="menu-item" href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`} target="_blank" rel="noreferrer">
                  Open Gmail ↗
                </a>
                <form action={signOutAction} onSubmit={() => void clearOffline()}>
                  <button className="menu-item">Sign out</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {offline && (
        <div className="banner offline" role="status">
          <span>
            <b>You&apos;re offline.</b> {savedAt ? `Showing your inbox from ${ago(savedAt, now)}.` : "Nothing saved on this phone yet."} Changes are paused until you&apos;re back online.
          </span>
        </div>
      )}
      {reauth && (
        <div className="banner" role="alert">
          <span>
            <b>DELT can&apos;t reach your Gmail.</b> Its access was removed in your Google account, so new mail won&apos;t show up. Sign in again to fix it.
          </span>
          {signInAction && (
            <form action={signInAction}>
              <button className="pillbtn on">Sign in again</button>
            </form>
          )}
        </div>
      )}

      <nav className="mast" aria-label="Sections">
        <button className={route.tab === "inbox" ? "on" : ""} onClick={() => goTab("inbox")} aria-current={route.tab === "inbox" ? "page" : undefined}>
          Inbox{counts.all.unread > 0 && <sup><span className="sr-only">, </span>{counts.all.unread > 99 ? "99+" : counts.all.unread}<span className="sr-only"> unread</span></sup>}
        </button>
        <button className={route.tab === "deadlines" ? "on" : ""} onClick={() => goTab("deadlines")} aria-current={route.tab === "deadlines" ? "page" : undefined}>
          Deadlines{dueCount > 0 && <sup><span className="sr-only">, </span>{dueCount}<span className="sr-only"> open</span></sup>}
        </button>
      </nav>

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
              title={query && searching ? "Searching…" : query ? "No results" : unreadOnly ? "No unread mail" : "No mail here"}
              hint={query && !searching ? "Try a sender or a word from the subject." : ""}
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
          {mails !== null && !query.trim() && (
            <div ref={sentinel} className="foot muted" aria-live="polite">
              {more ? (
                <button className="link" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? "Loading older mail…" : "Load older mail"}
                </button>
              ) : (
                <>That&apos;s all your mail in DELT</>
              )}
            </div>
          )}
          {query.trim() && shown.length > 0 && (
            <p className="foot muted" aria-live="polite">
              {searching ? "Searching all your mail…" : `${shown.length} result${shown.length === 1 ? "" : "s"}`}
            </p>
          )}
        </main>
      )}

      {/* ======================= DEADLINES ======================= */}
      {route.tab === "deadlines" && (
        <main className="page" key="deadlines">
          <div className="pagehead">
            <h1>Deadlines</h1>
            <p className="muted">Due dates found in your mail.</p>
          </div>
          {mails === null ? (
            <Skeleton />
          ) : BUCKETS.every((b) => buckets[b].length === 0) ? (
            <Empty title="No deadlines" hint="" />
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
                      <li key={m.id} className={`row due-row ${m.is_done ? "done" : ""}`} data-mail={m.id}>
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
          onReauth={() => setReauth(true)}
          restoreFocus={() => (openedFrom.current ? document.querySelector<HTMLElement>(`[data-mail="${CSS.escape(openedFrom.current)}"] .row-main`) : null)}
        />
      )}

      <Settings open={settingsOpen} section={settingsSection} onClose={() => setSettingsOpen(false)} onToast={(text) => setToast({ text })} />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
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
  // What a screen reader says for the row (the time and pile are only shown visually).
  const label = [
    m.unread ? "Unread." : "",
    `${sender}: ${cleanSubject(m.subject)}.`,
    `${pileLabel(m.priority)}, ${shortTime(m.received_at, now)}.`,
    m.deadline && !m.is_done ? `Due ${dueText(m.deadline, now)}.` : "",
    m.is_done ? "Done." : "",
  ].filter(Boolean).join(" ");

  return (
    <li className={`row ink-${m.priority} ${m.unread ? "unread" : ""} ${m.is_done ? "done" : ""} ${dx ? "dragging" : ""}`} data-mail={m.id}>
      <div className={`swipe-bg ${dx > 0 ? "r" : "l"} ${Math.abs(dx) > LIMIT ? "armed" : ""}`} aria-hidden="true">
        <span>{dx > 0 ? (m.unread ? "Read" : "Unread") : m.is_done ? "Not done" : "Done"}</span>
      </div>
      <div className="row-slide" style={{ transform: dx ? `translateX(${dx}px)` : undefined }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button className="row-main" onClick={() => !moved.current && onOpen()} aria-label={label} aria-describedby={m.summary || m.snippet ? `sum-${m.id}` : undefined}>
          <span className={`avatar p-${m.priority}`} aria-hidden="true">
            {initials(sender)}
          </span>
          <span className="when" aria-hidden="true">
            {shortTime(m.received_at, now)}
          </span>
          <span className="row-text">
            <span className="line1">
              <i className={`tagdot pdot p-${m.priority}`} title={pileLabel(m.priority)} aria-hidden="true" />
              <span className="from ell">{sender}</span>
              <span className="time">{shortTime(m.received_at, now)}</span>
            </span>
            <span className="subj ell">{cleanSubject(m.subject)}</span>
            <span className="sum ell" id={`sum-${m.id}`}>
              {m.summary || m.snippet}
            </span>
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
        {m.unread && <i className="unread-dot" aria-hidden="true" />}
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
      {hint && <span className="muted">{hint}</span>}
    </div>
  );
}
