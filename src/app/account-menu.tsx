"use client";

// The avatar button and its menu. Esc or a click/tab outside closes it (#8).
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/inbox";
import { clearOffline } from "@/lib/offline";

type Props = { name: string; email: string; signOutAction: () => Promise<void>; onSettings: (section?: "data" | "rules") => void };

export default function AccountMenu({ name, email, signOutAction, onSettings }: Props) {
  const [menu, setMenu] = useState(false);
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
  const settings = (section?: "data" | "rules") => {
    setMenu(false);
    onSettings(section);
  };

  return (
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
          <button className="menu-item" onClick={() => settings()}>
            Settings
          </button>
          <button className="menu-item" onClick={() => settings("rules")}>
            Sorting rules
          </button>
          <a className="menu-item" href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`} target="_blank" rel="noreferrer">
            Open Gmail ↗
          </a>
          {/* #53: everyday items, then signing out, then the one that can't be undone, kept apart */}
          <hr className="menu-sep" />
          <form action={signOutAction} onSubmit={() => void clearOffline()}>
            <button className="menu-item">Sign out</button>
          </form>
          <hr className="menu-sep" />
          <button className="menu-item danger" onClick={() => settings("data")}>
            Delete my data
          </button>
        </div>
      )}
    </div>
  );
}
