"use client";

// Settings sheet: phone notifications (#6), AI sorting key (#3), help links (#1),
// and deleting everything DELT keeps about you (#9).
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./use-dialog";
import { clearOffline } from "@/lib/offline";
import { pileLabel, type SenderRule } from "@/lib/inbox";

const REPO = "https://github.com/pranavvehmid/delt";

type AiInfo = { consent: boolean | null; ownKey: boolean; sharedAvailable: boolean; leftToday: number | null; perDay: number; status: string };
type PushState = "unsupported" | "blocked" | "off" | "on" | "busy";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function Settings({ open, onClose, onToast, section }: { open: boolean; onClose: () => void; onToast: (t: string) => void; section?: "data" | "rules" }) {
  const [push, setPush] = useState<PushState>("busy");
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropLabels, setDropLabels] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const box = useRef<HTMLElement>(null);
  const dataBlock = useRef<HTMLDivElement>(null);
  const rulesBlock = useRef<HTMLDivElement>(null);
  const [rules, setRules] = useState<SenderRule[] | null>(null);
  useDialog(box, open, onClose);

  const loadPush = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setPush("unsupported");
    if (Notification.permission === "denied") return setPush("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setPush(sub ? "on" : "off");
  }, []);
  const loadAi = useCallback(async () => {
    const r = await fetch("/api/settings/ai");
    if (r.ok) setAi(await r.json());
  }, []);

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
    loadPush();
    loadAi();
    loadRules();
    setConfirmDelete(false);
    if (section) requestAnimationFrame(() => (section === "data" ? dataBlock : rulesBlock).current?.scrollIntoView({ block: "center" }));
  }, [open, loadPush, loadAi, loadRules, section]);

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

  async function turnOn() {
    setPush("busy");
    try {
      const cfg = await (await fetch("/api/push")).json();
      if (!cfg.enabled || !cfg.publicKey) {
        onToast("Notifications aren't set up on the server yet");
        return loadPush();
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setPush(perm === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) }));
      const r = await fetch("/api/push", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error();
      setPush("on");
      onToast("Notifications on");
    } catch {
      onToast("Couldn't turn on notifications");
      loadPush();
    }
  }
  async function turnOff() {
    setPush("busy");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
      await sub.unsubscribe();
    }
    setPush("off");
    onToast("Notifications off");
  }

  async function saveKey() {
    setSaving(true);
    const r = await fetch("/api/settings/ai", { method: "POST", body: JSON.stringify({ key }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) return onToast(d.error ?? "Couldn't save the key");
    setKey("");
    onToast("Using your own key");
    loadAi();
  }
  async function setConsent(consent: boolean) {
    setAi((a) => (a ? { ...a, consent } : a));
    const r = await fetch("/api/settings/ai", { method: "POST", body: JSON.stringify({ consent }) });
    onToast(r.ok ? (consent ? "AI sorting on" : "Rules only") : "Couldn't save that");
    loadAi();
  }
  async function removeKey() {
    await fetch("/api/settings/ai", { method: "DELETE" });
    onToast("Back to the shared AI");
    loadAi();
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

        <div className="set-block">
          <div className="set-row">
            <span>
              <b>Notifications</b>
              <small className="muted">
                {push === "unsupported"
                  ? "This browser can't show them. On iPhone, add DELT to your Home Screen first."
                  : push === "blocked"
                    ? "Blocked. Allow notifications for DELT in your phone's settings."
                    : "Urgent mail, and deadlines due within a day."}
              </small>
            </span>
            {(push === "on" || push === "off" || push === "busy") && (
              <label className="toggle">
                <input type="checkbox" aria-label="Notifications" checked={push === "on"} disabled={push === "busy"} onChange={(e) => (e.target.checked ? turnOn() : turnOff())} />
                <span className="knob" aria-hidden="true" />
              </label>
            )}
          </div>
        </div>

        <div className="set-block">
          <div className="set-row">
            <span>
              <b>AI sorting</b>
              <small className="muted">
                {!ai
                  ? "…"
                  : ai.consent !== true
                    ? "Off: rules only. Turn on to let Gemini double-check mail the rules aren't sure about."
                    : ai.ownKey
                    ? "Using your own Gemini key."
                    : ai.sharedAvailable
                      ? `Using the shared free AI. ${ai.leftToday ?? 0} of ${ai.perDay} checks left today.`
                      : "Rules only. Add a free Gemini key to let AI check unclear mail."}
              </small>
            </span>
            {ai && (
              <label className="toggle">
                <input type="checkbox" aria-label="Use AI for unclear mail" checked={ai.consent === true} onChange={(e) => setConsent(e.target.checked)} />
                <span className="knob" aria-hidden="true" />
              </label>
            )}
          </div>
          {ai?.consent === true && (
            <small className="muted">
              Sender, subject and the start of the text go to Google&apos;s Gemini free tier, which Google may use to improve its models.{" "}
              <a className="link" href="/privacy">
                Privacy
              </a>
            </small>
          )}
          {ai?.consent !== true ? null : ai?.ownKey ? (
            <button className="pillbtn" onClick={removeKey}>
              Remove my key
            </button>
          ) : (
            <form
              className="keyform"
              onSubmit={(e) => {
                e.preventDefault();
                if (key.trim()) saveKey();
              }}
            >
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Your Gemini API key" autoComplete="off" spellCheck={false} aria-label="Your Gemini API key" />
              <button className="pillbtn" disabled={saving || !key.trim()}>
                {saving ? "Checking…" : "Save"}
              </button>
            </form>
          )}
          {ai?.consent === true && !ai?.ownKey && (
            <small className="muted">
              Free from{" "}
              <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              . It&apos;s stored encrypted and only used for your mail.
            </small>
          )}
        </div>

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
                Also remove the MailSort labels from Gmail
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
