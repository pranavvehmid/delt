"use client";

import { useEffect, useRef, useState } from "react";

// Two looks (Calm is minimal and smooth, Glyph is the chunky dot-matrix one),
// each in dark or light. Saved per device in localStorage.
export type Look = "calm" | "glyph";
export type Mode = "dark" | "light";

const THEMES: { look: Look; mode: Mode; name: string; hint: string; swatch: [string, string, string] }[] = [
  { look: "calm", mode: "dark", name: "Calm night", hint: "minimal · soft", swatch: ["#120e20", "#1c1631", "#e9c45b"] },
  { look: "calm", mode: "light", name: "Calm day", hint: "minimal · soft", swatch: ["#f7f5f0", "#ffffff", "#c99a1c"] },
  { look: "glyph", mode: "dark", name: "Glyph night", hint: "bold · dotted", swatch: ["#17112b", "#261c45", "#f5c842"] },
  { look: "glyph", mode: "light", name: "Glyph ivory", hint: "bold · dotted", swatch: ["#fff8e8", "#ffffff", "#f5c842"] },
];

export function applyTheme(look: Look, mode: Mode) {
  const root = document.documentElement;
  root.classList.add("theming"); // lets colours cross-fade instead of snapping
  root.dataset.look = look;
  root.dataset.theme = mode;
  const bg = THEMES.find((t) => t.look === look && t.mode === mode)!.swatch[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  try {
    localStorage.setItem("delt-look", look);
    localStorage.setItem("delt-theme", mode);
  } catch {}
  window.setTimeout(() => root.classList.remove("theming"), 450);
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState<{ look: Look; mode: Mode }>({ look: "calm", mode: "dark" });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = document.documentElement.dataset;
    setCur({ look: d.look === "glyph" ? "glyph" : "calm", mode: d.theme === "light" ? "light" : "dark" });
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="themepick" ref={box}>
      <button className="btn icon" onClick={() => setOpen((o) => !o)} aria-label="Choose theme" aria-expanded={open} title="Theme">
        ◐
      </button>
      <div className={`themes ${open ? "open" : ""}`} role="menu" aria-hidden={!open}>
        <div className="themes-h mono">THEME</div>
        {THEMES.map((t) => {
          const on = t.look === cur.look && t.mode === cur.mode;
          return (
            <button
              key={t.name}
              role="menuitemradio"
              aria-checked={on}
              tabIndex={open ? 0 : -1}
              className={`theme-opt ${on ? "on" : ""}`}
              onClick={() => {
                applyTheme(t.look, t.mode);
                setCur({ look: t.look, mode: t.mode });
              }}
            >
              <span className="sw" style={{ background: t.swatch[0] }}>
                <span style={{ background: t.swatch[1] }} />
                <span style={{ background: t.swatch[2] }} />
              </span>
              <span className="tn">
                <b>{t.name}</b>
                <small>{t.hint}</small>
              </span>
              <span className="tick" aria-hidden="true">{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
