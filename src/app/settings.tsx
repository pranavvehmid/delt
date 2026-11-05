"use client";

// Settings sheet: phone notifications (#6), AI sorting key (#3), and help links (#1).
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const REPO = "https://github.com/pranavvehmid/delt";

type AiInfo = { ownKey: boolean; sharedAvailable: boolean; leftToday: number | null; perDay: number; status: string };
type PushState = "unsupported" | "blocked" | "off" | "on" | "busy";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function Settings({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (t: string) => void }) {
  const [push, setPush] = useState<PushState>("busy");
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    loadPush();
    loadAi();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, loadPush, loadAi, onClose]);

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
  async function removeKey() {
    await fetch("/api/settings/ai", { method: "DELETE" });
    onToast("Back to the shared AI");
    loadAi();
  }

  if (!open) return null;
  return createPortal(
    <>
      <div className="veil" onClick={onClose} />
      <section className="sheet settings" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2>Settings</h2>
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
                <input type="checkbox" checked={push === "on"} disabled={push === "busy"} onChange={(e) => (e.target.checked ? turnOn() : turnOff())} />
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
                  : ai.ownKey
                    ? "Using your own Gemini key."
                    : ai.sharedAvailable
                      ? `Using the shared free AI. ${ai.leftToday ?? 0} of ${ai.perDay} checks left today.`
                      : "Rules only. Add a free Gemini key to let AI check unclear mail."}
              </small>
            </span>
          </div>
          {ai?.ownKey ? (
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
          {!ai?.ownKey && (
            <small className="muted">
              Free from{" "}
              <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              . It&apos;s stored encrypted and only used for your mail.
            </small>
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
        </div>
      </section>
    </>,
    document.body,
  );
}
