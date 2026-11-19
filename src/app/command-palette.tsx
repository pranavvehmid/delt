"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PILES, cleanSender } from "@/lib/inbox";
import type { EmailRow, Priority } from "@/lib/supabase";
import { useDialog } from "./use-dialog";
import type { Route } from "./use-screen";

type Command = { id: string; label: string; detail?: string; run: () => void };
type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  mails: EmailRow[];
  current: EmailRow | null;
  unreadOnly: boolean;
  go: (tab: Route["tab"]) => void;
  search: (query?: string) => void;
  move: (priority: Priority) => void;
  settings: () => void;
  toggleUnread: () => void;
};

export default function CommandPalette(p: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const sheet = useRef<HTMLElement>(null);
  useDialog(sheet, p.open, p.onClose);

  const { open, onOpen } = p;
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (open || document.querySelector('[aria-modal="true"]:not(.mailview)')) return;
      event.preventDefault();
      onOpen();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open, onOpen]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const senders = useMemo(() => {
    if (!open) return [];
    const found = new Map<string, string>();
    for (const { from_address, from_name } of p.mails) {
      const address = from_address?.trim().toLowerCase();
      if (address && !found.has(address)) found.set(address, cleanSender(from_name) || address);
    }
    return [...found];
  }, [open, p.mails]);
  if (!open) return null;

  const text = query.trim();
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (s: string) => terms.every((word) => s.toLowerCase().includes(word));
  const commands: Command[] = [
    { id: "inbox", label: "Go to Inbox", run: () => p.go("inbox") },
    { id: "deadlines", label: "Go to Deadlines", run: () => p.go("deadlines") },
    { id: "search", label: "Search mail", run: () => p.search() },
    { id: "settings", label: "Open Settings", run: p.settings },
    { id: "unread", label: p.unreadOnly ? "Show read and unread mail" : "Show unread mail only", run: p.toggleUnread },
    ...PILES.filter((pile) => p.current && p.current.priority !== pile.key).map((pile) => ({
      id: `move-${pile.key}`, label: `Move mail to ${pile.label}`, run: () => p.move(pile.key),
    })),
  ].filter(({ label }) => matches(label));
  if (text) {
    commands.push(...senders.filter(([address, name]) => matches(`Mail from ${name} ${address}`)).slice(0, 6).map(([address, name]) => ({
      id: address, label: `Mail from ${name}`, detail: address, run: () => p.search(address),
    })));
    commands.push({ id: "search-query", label: `Search for “${text}”`, run: () => p.search(text) });
  }

  function run(command: Command) {
    p.onClose();
    command.run();
  }

  const selected = Math.min(index, commands.length - 1);
  return createPortal(
    <>
      <div className="veil" onClick={p.onClose} />
      <section className="sheet command-palette" role="dialog" aria-modal="true" aria-labelledby="commands-title" ref={sheet}>
        <header className="sheet-head">
          <h2 id="commands-title">Commands</h2>
          <button className="link" onClick={p.onClose}>Close</button>
        </header>
        <input
          role="combobox" aria-label="Find a command or sender" aria-expanded="true" aria-controls="command-results"
          aria-activedescendant={selected < 0 ? undefined : `command-option-${selected}`}
          autoComplete="off" data-autofocus value={query} maxLength={160} placeholder="Find a command or sender"
          onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && commands[selected]) {
              event.preventDefault();
              run(commands[selected]);
            }
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && commands.length) {
              event.preventDefault();
              const next = (selected + (event.key === "ArrowDown" ? 1 : -1) + commands.length) % commands.length;
              setIndex(next);
              document.getElementById(`command-option-${next}`)?.scrollIntoView({ block: "nearest" });
            }
          }}
        />
        <ul id="command-results" role="listbox" aria-label="Commands">
          {commands.map((command, i) => (
            <li key={command.id} id={`command-option-${i}`} role="option" aria-selected={i === selected} onClick={() => run(command)}>
              <span>{command.label}</span>{command.detail && <small className="muted">{command.detail}</small>}
            </li>
          ))}
        </ul>
      </section>
    </>,
    document.body,
  );
}
