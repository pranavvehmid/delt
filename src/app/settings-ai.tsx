"use client";

// Settings → AI sorting (#3, #31): off until the student agrees; the shared free key or their own.
import { useCallback, useEffect, useState } from "react";

type AiInfo = {
  consent: boolean | null;
  ownKey: boolean;
  sharedAvailable: boolean;
  leftToday: number | null;
  perDay: number;
  status: string;
};

export default function AiSetting({
  onToast,
}: {
  onToast: (t: string) => void;
}) {
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const loadAi = useCallback(async () => {
    const r = await fetch("/api/settings/ai");
    if (r.ok) setAi(await r.json());
  }, []);
  useEffect(() => {
    loadAi();
  }, [loadAi]);

  async function saveKey() {
    setSaving(true);
    const r = await fetch("/api/settings/ai", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) return onToast(d.error ?? "Couldn't save the key");
    setKey("");
    onToast("Using your own key");
    loadAi();
  }
  async function setConsent(consent: boolean) {
    setAi((a) => (a ? { ...a, consent } : a));
    const r = await fetch("/api/settings/ai", {
      method: "POST",
      body: JSON.stringify({ consent }),
    });
    onToast(
      r.ok ? (consent ? "AI sorting on" : "Rules only") : "Couldn't save that",
    );
    loadAi();
  }
  async function removeKey() {
    await fetch("/api/settings/ai", { method: "DELETE" });
    onToast("Back to the shared AI");
    loadAi();
  }

  return (
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
            <input
              type="checkbox"
              aria-label="Use AI for unclear mail"
              checked={ai.consent === true}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="knob" aria-hidden="true" />
          </label>
        )}
      </div>
      {ai?.consent === true && (
        <small className="muted">
          Sender, subject and the start of the text go to Google&apos;s Gemini
          free tier, which Google may use to improve its models.{" "}
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
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Your Gemini API key"
            autoComplete="off"
            spellCheck={false}
            aria-label="Your Gemini API key"
          />
          <button className="pillbtn" disabled={saving || !key.trim()}>
            {saving ? "Checking…" : "Save"}
          </button>
        </form>
      )}
      {ai?.consent === true && !ai?.ownKey && (
        <small className="muted">
          Free from{" "}
          <a
            className="link"
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            Google AI Studio
          </a>
          . It&apos;s stored encrypted and only used for your mail.
        </small>
      )}
    </div>
  );
}
