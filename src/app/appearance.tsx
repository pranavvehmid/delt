"use client";

// Appearance panel: look (Minimal or Glyph), light/dark/auto, accent colour,
// text size and spacing. Saved on this device; applied as data-* on <html>.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULTS, KEY, parsePrefs, toDataset, type Prefs } from "@/lib/prefs";

const ACCENTS: { key: Prefs["accent"]; label: string; color: string }[] = [
  {
    key: "auto",
    label: "Default",
    color: "conic-gradient(#5b3fd6 0 50%, #f5c842 0)",
  },
  { key: "purple", label: "Purple", color: "#6a4be0" },
  { key: "blue", label: "Blue", color: "#1a73e8" },
  { key: "green", label: "Green", color: "#188038" },
  { key: "red", label: "Red", color: "#d93025" },
  { key: "gold", label: "Gold", color: "#e0a810" },
];

function readPrefs(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(KEY), {
      look: localStorage.getItem("delt-look"),
      theme: localStorage.getItem("delt-theme"),
    });
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const root = document.documentElement;
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.add("theming"); // cross-fade colours instead of snapping
  Object.assign(root.dataset, toDataset(p, dark));
  window.setTimeout(() => {
    root.classList.remove("theming");
    const bg = getComputedStyle(document.body).backgroundColor;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bg);
  }, 380);
}

export default function Appearance() {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    setP(readPrefs());
    // "Auto" follows the phone live.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => readPrefs().mode === "auto" && apply(readPrefs());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    const next = { ...p, [k]: v };
    setP(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.removeItem("delt-look");
      localStorage.removeItem("delt-theme");
    } catch {}
    apply(next);
  }

  const Seg = <K extends keyof Prefs>({
    k,
    items,
    label,
  }: {
    k: K;
    items: [Prefs[K], string][];
    label: string;
  }) => (
    <div className="ap-row">
      <span className="ap-lbl">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {items.map(([v, t]) => (
          <button
            key={v}
            role="radio"
            aria-checked={p[k] === v}
            className={p[k] === v ? "on" : ""}
            onClick={() => set(k, v)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        className="iconbtn"
        onClick={() => setOpen(true)}
        aria-label="Appearance"
        title="Appearance"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open &&
        createPortal(
          <>
            <div className="veil" onClick={() => setOpen(false)} />
            <section
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Appearance"
            >
              <div className="sheet-grip" aria-hidden="true" />
              <header className="sheet-head">
                <h2>Appearance</h2>
                <button className="link" onClick={() => setOpen(false)}>
                  Done
                </button>
              </header>

              <div className="looks" role="radiogroup" aria-label="Look">
                {(["minimal", "glyph"] as const).map((l) => (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={p.look === l}
                    className={`look-card ${p.look === l ? "on" : ""}`}
                    onClick={() => set("look", l)}
                  >
                    <span className={`look-prev lp-${l}`} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{l === "minimal" ? "Minimal" : "Glyph"}</b>
                    <small>
                      {l === "minimal"
                        ? "Clean list, one font, quiet"
                        : "Bold dot-matrix cards"}
                    </small>
                  </button>
                ))}
              </div>

              <Seg
                k="mode"
                label="Theme"
                items={[
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["auto", "Auto"],
                ]}
              />

              <div className="ap-row">
                <span className="ap-lbl">Accent</span>
                <div
                  className="swatches"
                  role="radiogroup"
                  aria-label="Accent colour"
                >
                  {ACCENTS.map((a) => (
                    <button
                      key={a.key}
                      role="radio"
                      aria-checked={p.accent === a.key}
                      aria-label={a.label}
                      title={a.label}
                      className={`swatch ${p.accent === a.key ? "on" : ""}`}
                      style={{ background: a.color }}
                      onClick={() => set("accent", a.key)}
                    />
                  ))}
                </div>
              </div>

              <Seg
                k="size"
                label="Text"
                items={[
                  ["normal", "Normal"],
                  ["large", "Large"],
                ]}
              />
              <Seg
                k="density"
                label="Spacing"
                items={[
                  ["comfortable", "Comfortable"],
                  ["compact", "Compact"],
                ]}
              />

              <p className="ap-note muted">Saved on this device.</p>
            </section>
          </>,
          document.body, // outside the blurred top bar, which would trap a fixed panel
        )}
    </>
  );
}
