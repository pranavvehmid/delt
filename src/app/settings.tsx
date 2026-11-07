"use client";

// Settings sheet: phone notifications (#6), AI sorting key (#3), help links (#1),
// and deleting everything DELT keeps about you (#9).
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./use-dialog";
import PushSetting from "./settings-push";
import AiSetting from "./settings-ai";
import { clearOffline } from "@/lib/offline";
import { pileLabel, type SenderRule } from "@/lib/inbox";

const REPO = "https://github.com/pranavvehmid/delt";

export default function Settings({ open, onClose, onToast, section }: { open: boolean; onClose: () => void; onToast: (t: string) => void; section?: "data" | "rules" }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropLabels, setDropLabels] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const box = useRef<HTMLElement>(null);
  const dataBlock = useRef<HTMLDivElement>(null);
  const rulesBlock = useRef<HTMLDivElement>(null);
  const [rules, setRules] = useState<SenderRule[] | null>(null);
  useDialog(box, open, onClose);

  const loadRules = useCallback(async () => {
    const r = await fetch("/api/rules");
    setRules(r.ok ? (await r.json()).rules ?? [] : []);
  }, []);
  async function forget(rule: SenderRule) {
    setRules((l) => l?.filter((x) => x.from !== rule.from) ?? null);
    const r = await fetch(`/api/rules?from=${encodeURIComponent(rule.from)}`, { method: "DELETE" });
    if (!r.ok) {
      onToast("Couldn't remove that rule");
      return loadRules();
    }
    onToast(`DELT will sort mail from ${rule.name} by itself again`);
  }

  useEffect(() => {
    if (!open) return;
    loadRules();
    setConfirmDelete(false);
    if (section) requestAnimationFrame(() => (section === "data" ? dataBlock : rulesBlock).current?.scrollIntoView({ block: "center" }));
  }, [open, loadRules, section]);

  async function deleteEverything() {
    setDeleting(true);
    try {
      // turn off this phone's notifications too
      const reg = await navigator.serviceWorker?.getRegistration("/");
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
    } catch {}
    const r = await fetch("/api/account", { method: "DELETE", body: JSON.stringify({ removeLabels: dropLabels }) });
    if (!r.ok) {
      setDeleting(false);
      return onToast("Couldn't delete. Try again in a minute.");
    }
    await clearOffline(); // the inbox saved on this phone goes too
    location.href = "/?deleted=1";
  }

  if (!open) return null;
  return createPortal(
    <>
      <div className="veil" onClick={onClose} />
      <section className="sheet settings" role="dialog" aria-modal="true" aria-labelledby="set-title" ref={box}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id="set-title" tabIndex={-1} data-autofocus>
            Settings
          </h2>
          <button className="link" onClick={onClose}>
            Done
          </button>
        </header>

        <PushSetting onToast={onToast} />
        <AiSetting onToast={onToast} />

        <div className="set-block" ref={rulesBlock}>
          <b>Your sorting rules</b>
          <small className="muted">When you move a mail to another pile, DELT sends that sender&apos;s new mail there too.</small>
          {rules === null ? (
            <small className="muted">…</small>
          ) : rules.length === 0 ? (
            <small className="muted">None yet.</small>
          ) : (
            <ul className="rules">
              {rules.map((r) => (
                <li key={r.from}>
                  <span className="ell">
                    <b className="ell">{r.name}</b>
                    <small className="muted ell">{r.from}</small>
                  </span>
                  <span className={`rule-pile p-${r.priority}`}>{pileLabel(r.priority)}</span>
                  <button className="pillbtn" onClick={() => forget(r)} aria-label={`Remove rule: mail from ${r.name} goes to ${pileLabel(r.priority)}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="set-block">
          <b>Help</b>
          <a className="set-link" href={`${REPO}/issues/new?template=bug.md&labels=bug`} target="_blank" rel="noreferrer">
            Report a problem ↗
          </a>
          <a className="set-link" href={`${REPO}/issues/1`} target="_blank" rel="noreferrer">
            Help test DELT ↗
          </a>
          <a className="set-link" href={REPO} target="_blank" rel="noreferrer">
            Source code ↗
          </a>
          <a className="set-link" href="/privacy">
            Privacy ↗
          </a>
        </div>

        <div className="set-block danger" ref={dataBlock}>
          <b>Your data</b>
          <small className="muted">
            DELT keeps your Google sign-in token and a short preview of each mail (sender, subject, a line of text). Deleting removes all of it, signs you out and
            cancels DELT&apos;s access to your Gmail. Your mail itself stays in Gmail.
          </small>
          {!confirmDelete ? (
            <button className="pillbtn" onClick={() => setConfirmDelete(true)}>
              Delete my data
            </button>
          ) : (
            <div className="confirm" role="group" aria-label="Confirm delete">
              <label className="check">
                <input type="checkbox" checked={dropLabels} onChange={(e) => setDropLabels(e.target.checked)} />
                Also remove the DELT labels from Gmail
              </label>
              <p>This can&apos;t be undone.</p>
              <div>
                <button className="pillbtn on" onClick={deleteEverything} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete everything"}
                </button>
                <button className="pillbtn" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>,
    document.body,
  );
}
