"use client";

// Inbox / Deadlines: tabs at the top on wide screens, a tab bar at the bottom on phones.
import { goTab, type Route } from "./use-screen";

type Props = { tab: Route["tab"]; unread: number; dueCount: number };

export function TopTabs({ tab, unread, dueCount }: Props) {
  return (
    <nav className="mast" aria-label="Sections">
      <button className={tab === "inbox" ? "on" : ""} onClick={() => goTab("inbox")} aria-current={tab === "inbox" ? "page" : undefined} title={unread > 0 ? `${unread} unread in Urgent and Priority` : undefined}>
        Inbox{unread > 0 && <sup><span className="sr-only">, </span>{unread > 99 ? "99+" : unread}<span className="sr-only"> unread in Urgent and Priority</span></sup>}
      </button>
      <button className={tab === "deadlines" ? "on" : ""} onClick={() => goTab("deadlines")} aria-current={tab === "deadlines" ? "page" : undefined} title={dueCount > 0 ? `${dueCount} open deadline${dueCount === 1 ? "" : "s"}` : undefined}>
        Deadlines{dueCount > 0 && <sup><span className="sr-only">, </span>{dueCount}<span className="sr-only"> open</span></sup>}
      </button>
    </nav>
  );
}

export function TabBar({ tab, unread, dueCount }: Props) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <button className={tab === "inbox" ? "on" : ""} onClick={() => goTab("inbox")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z" /></svg>
        Inbox
        {unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      <button className={tab === "deadlines" ? "on" : ""} onClick={() => goTab("deadlines")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
        Deadlines
        {dueCount > 0 && <span className="badge">{dueCount}</span>}
      </button>
    </nav>
  );
}
