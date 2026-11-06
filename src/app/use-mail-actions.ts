"use client";

// Changes to mail: shown on screen at once, then saved and mirrored to Gmail, with Undo.
import type { Dispatch, SetStateAction } from "react";
import type { EmailRow, Priority } from "@/lib/supabase";
import { cleanSender, pileLabel } from "@/lib/inbox";
import type { ToastMsg } from "./toast";

export type Patch = { read?: boolean; is_done?: boolean; priority?: Priority; teach?: boolean; deadline?: null };

type Lists = {
  mails: EmailRow[] | null;
  hits: EmailRow[] | null;
  due: EmailRow[];
  setMails: Dispatch<SetStateAction<EmailRow[] | null>>;
  setHits: Dispatch<SetStateAction<EmailRow[] | null>>;
  setDue: Dispatch<SetStateAction<EmailRow[]>>;
  offline: boolean;
  setAiConsent: (c: boolean | null) => void;
  say: (t: ToastMsg) => void;
};

export function apply(m: EmailRow, p: Patch): EmailRow {
  return {
    ...m,
    ...(p.read !== undefined ? { unread: !p.read } : {}),
    ...(p.is_done !== undefined ? { is_done: p.is_done } : {}),
    ...(p.priority ? { priority: p.priority, user_corrected: p.teach !== false } : {}),
    ...(p.deadline === null ? { deadline: null } : {}),
  };
}

export function useMailActions({ mails, hits, due, setMails, setHits, setDue, offline, setAiConsent, say }: Lists) {
  const findMail = (id: string) => mails?.find((m) => m.id === id) ?? hits?.find((m) => m.id === id) ?? due.find((m) => m.id === id) ?? null;
  const updateAll = (fn: (m: EmailRow) => EmailRow) => {
    setMails((l) => l?.map(fn) ?? null);
    setHits((l) => l?.map(fn) ?? null);
    setDue((l) => l.map(fn));
  };
  const blockedOffline = () => {
    if (!offline) return false;
    say({ text: "You're offline. Changes are paused until you're back online." });
    return true;
  };

  function patch(id: string, p: Patch, quiet = false) {
    if (blockedOffline()) return;
    const before = findMail(id);
    updateAll((m) => (m.id === id ? apply(m, p) : m));
    fetch("/api/emails", { method: "PATCH", body: JSON.stringify({ id, ...p }) }).then((r) => !r.ok && say({ text: "Couldn't save that change" }));
    if (quiet || !before) return;
    const undo = () => {
      if (p.deadline === null) {
        // put the removed deadline back
        updateAll((m) => (m.id === id ? { ...m, deadline: before.deadline } : m));
        void fetch("/api/emails", { method: "PATCH", body: JSON.stringify({ id, deadline: before.deadline }) });
        return;
      }
      patch(id, { read: p.read !== undefined ? !before.unread : undefined, is_done: p.is_done !== undefined ? before.is_done : undefined, priority: p.priority ? before.priority : undefined }, true);
    };
    // Moving a mail also teaches DELT where that sender's mail goes: say so, and offer a one-off move (#46).
    if (p.priority && p.teach !== false) {
      const sender = cleanSender(before.from_name);
      const to = pileLabel(p.priority);
      return say({
        text: `Moved to ${to}. New mail from ${sender} will go there too.`,
        undo,
        alt: { label: "Just this one", run: () => {
          patch(id, { priority: p.priority, teach: false }, true);
          say({ text: `Moved to ${to}, no rule for ${sender}` });
        } },
      });
    }
    const text =
      p.deadline === null ? "Deadline removed" : p.priority ? `Moved to ${pileLabel(p.priority)}` : p.is_done !== undefined ? (p.is_done ? "Marked done" : "Not done") : p.read ? "Marked read" : "Marked unread";
    say({ text, undo });
  }

  async function markAllRead(ids: string[]) {
    if (blockedOffline()) return;
    const set = new Set(ids);
    updateAll((m) => (set.has(m.id) ? { ...m, unread: false } : m));
    // Undo puts back exactly these, in DELT and in Gmail (#47)
    const undo = () => {
      updateAll((m) => (set.has(m.id) ? { ...m, unread: true } : m));
      fetch("/api/emails/bulk", { method: "POST", body: JSON.stringify({ ids, read: false }) }).then((r) => !r.ok && say({ text: "Couldn't update Gmail" }));
    };
    say({ text: `${ids.length} marked read`, undo });
    const r = await fetch("/api/emails/bulk", { method: "POST", body: JSON.stringify({ ids, read: true }) });
    if (!r.ok) say({ text: "Couldn't update Gmail" });
  }

  async function answerAi(consent: boolean) {
    setAiConsent(consent);
    say({ text: consent ? "AI sorting on. Change it in Settings." : "Rules only. Change it in Settings." });
    const r = await fetch("/api/settings/ai", { method: "POST", body: JSON.stringify({ consent }) });
    if (!r.ok) setAiConsent(null);
  }

  return { findMail, patch, markAllRead, answerAi };
}
