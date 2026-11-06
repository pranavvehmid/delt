"use client";

// Settings → Notifications (#6): urgent mail and deadlines due within a day, on this phone.
import { useCallback, useEffect, useState } from "react";

type PushState = "unsupported" | "blocked" | "off" | "on" | "busy";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushSetting({
  onToast,
}: {
  onToast: (t: string) => void;
}) {
  const [push, setPush] = useState<PushState>("busy");
  const loadPush = useCallback(async () => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return setPush("unsupported");
    if (Notification.permission === "denied") return setPush("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setPush(sub ? "on" : "off");
  }, []);
  useEffect(() => {
    loadPush();
  }, [loadPush]);

  async function turnOn() {
    setPush("busy");
    try {
      const cfg = await (await fetch("/api/push")).json();
      if (!cfg.enabled || !cfg.publicKey) {
        onToast("Notifications aren't set up on the server yet");
        return loadPush();
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted")
        return setPush(perm === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(cfg.publicKey),
        }));
      const r = await fetch("/api/push", {
        method: "POST",
        body: JSON.stringify(sub.toJSON()),
      });
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
      await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
        method: "DELETE",
      });
      await sub.unsubscribe();
    }
    setPush("off");
    onToast("Notifications off");
  }

  return (
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
            <input
              type="checkbox"
              aria-label="Notifications"
              checked={push === "on"}
              disabled={push === "busy"}
              onChange={(e) => (e.target.checked ? turnOn() : turnOff())}
            />
            <span className="knob" aria-hidden="true" />
          </label>
        )}
      </div>
    </div>
  );
}
