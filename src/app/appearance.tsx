"use client";

// Appearance panel: look (Minimal or Glyph), light/dark/auto, accent colour,
// text size and spacing. Saved on this device; applied as data-* on <html>.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULTS, KEY, LOOK_ACCENTS, parsePrefs, toDataset, type Prefs } from "@/lib/prefs";
import { useDialog } from "./use-dialog";
import { transition } from "./motion";

const ACCENTS: { key: Prefs["accent"]; label: string; color: string }[] = [
  {
    key: "auto",
    label: "Default",
    color: "conic-gradient(#c8102e 0 50%, #f5c842 0)",
  },
  { key: "purple", label: "Purple", color: "#6a4be0" },
  { key: "blue", label: "Blue", color: "#1a73e8" },
  { key: "green", label: "Green", color: "#188038" },
  { key: "red", label: "Red", color: "#d93025" },
  { key: "gold", label: "Gold", color: "#e0a810" },
];
// Grid's "driver colours": paddock colours, named by colour (team and driver names are trademarks).
const GRID_ACCENTS: { key: Prefs["accent"]; label: string; color: string }[] = [
  { key: "auto", label: "Race red", color: "#e10600" },
  { key: "papaya", label: "Papaya", color: "#ff8000" },
  { key: "teal", label: "Teal", color: "#27f4d2" },
  { key: "navy", label: "Navy", color: "#3671c6" },
  { key: "racing", label: "Racing green", color: "#229971" },
  { key: "sky", label: "Sky", color: "#64c4ff" },
  { key: "pink", label: "Pink", color: "#ff87bc" },
  { key: "gold", label: "Black and gold", color: "conic-gradient(#d4a017 0 50%, #111 0)" },
];
const LOOKS = [
  { key: "minimal", name: "Minimal", note: "Black and white" },
  { key: "glyph", name: "Glyph", note: "Purple and gold" },
  { key: "grid", name: "Grid", note: "F1-inspired, race dark" },
] as const;

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
  // one GPU cross-fade of the whole screen, instead of animating every element's colours
  transition(() => Object.assign(root.dataset, toDataset(p, dark)));
  window.setTimeout(() => {
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
  const box = useRef<HTMLElement>(null);
  const show = (v: boolean) => transition(() => setOpen(v));
  useDialog(box, open, () => show(false));

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    const next = { ...p, [k]: v };
    // each look has its own colours; Grid is always dark
    if (!LOOK_ACCENTS[next.look].includes(next.accent)) next.accent = "auto";
    if (next.look === "grid" && (next.mode === "light" || next.mode === "auto")) next.mode = "dark";
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
        onClick={() => show(true)}
        aria-label="Appearance"
        aria-haspopup="dialog"
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
            <div className="veil" onClick={() => show(false)} />
            <section
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ap-title"
              ref={box}
            >
              <div className="sheet-grip" aria-hidden="true" />
              <header className="sheet-head">
                <h2 id="ap-title" tabIndex={-1} data-autofocus>Appearance</h2>
                <button className="link" onClick={() => show(false)}>
                  Done
                </button>
              </header>

              <div className="looks" role="radiogroup" aria-label="Look">
                {LOOKS.map((l) => (
                  <button
                    key={l.key}
                    role="radio"
                    aria-checked={p.look === l.key}
                    className={`look-card ${p.look === l.key ? "on" : ""}`}
                    onClick={() => set("look", l.key)}
                  >
                    <span className={`look-prev lp-${l.key}`} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{l.name}</b>
                    <small>{l.note}</small>
                  </button>
                ))}
              </div>

              <Seg
                k="mode"
                label="Theme"
                items={
                  p.look === "grid"
                    ? [
                        ["dark", "Dark"],
                        ["black", "Extra dark"],
                      ]
                    : [
                        ["light", "Light"],
                        ["dark", "Dark"],
                        ["black", "Extra dark"],
                        ["auto", "Auto"],
                      ]
                }
              />

              <div className="ap-row">
                <span className="ap-lbl">{p.look === "grid" ? "Driver colour" : "Accent"}</span>
                <div
                  className="swatches"
                  role="radiogroup"
                  aria-label="Accent colour"
                >
                  {(p.look === "grid" ? GRID_ACCENTS : ACCENTS).map((a) => (
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

            </section>
          </>,
          document.body, // outside the blurred top bar, which would trap a fixed panel
        )}
    </>
  );
}
