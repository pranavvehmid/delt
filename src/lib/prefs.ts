// Appearance preferences: look, light/dark, accent, text size, spacing.
// Saved per device in localStorage and applied as data-* attributes on <html>.

export type Prefs = {
  look: "minimal" | "glyph";
  mode: "light" | "dark" | "auto";
  accent: "auto" | "purple" | "blue" | "green" | "red" | "gold";
  size: "normal" | "large";
  density: "comfortable" | "compact";
};

export const OPTIONS = {
  look: ["minimal", "glyph"],
  mode: ["light", "dark", "auto"],
  accent: ["auto", "purple", "blue", "green", "red", "gold"],
  size: ["normal", "large"],
  density: ["comfortable", "compact"],
} as const satisfies { [K in keyof Prefs]: readonly Prefs[K][] };

export const DEFAULTS: Prefs = { look: "minimal", mode: "light", accent: "auto", size: "normal", density: "comfortable" };
export const KEY = "delt-prefs";

/** Reads saved prefs, ignoring junk. Also upgrades the old "delt-look"/"delt-theme" keys. */
export function parsePrefs(raw: string | null, legacy: { look?: string | null; theme?: string | null } = {}): Prefs {
  let saved: Record<string, unknown> = {};
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object" && !Array.isArray(v)) saved = v;
  } catch {}
  const out: Prefs = { ...DEFAULTS };
  if (!raw) {
    if (legacy.look) out.look = legacy.look === "glyph" ? "glyph" : "minimal";
    if (legacy.theme === "dark" || legacy.theme === "light") out.mode = legacy.theme;
  }
  for (const k of Object.keys(OPTIONS) as (keyof Prefs)[]) {
    const v = saved[k];
    if ((OPTIONS[k] as readonly unknown[]).includes(v)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** "auto" follows the phone. */
export const resolveMode = (mode: Prefs["mode"], systemDark: boolean): "light" | "dark" => (mode === "auto" ? (systemDark ? "dark" : "light") : mode);

/** The attributes set on <html>. */
export function toDataset(p: Prefs, systemDark: boolean) {
  return { look: p.look, theme: resolveMode(p.mode, systemDark), accent: p.accent, size: p.size, density: p.density };
}

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong
 * theme. Kept as a plain string (bundlers rewrite real functions);
 * tests/prefs.test.ts runs it and checks it agrees with parsePrefs/toDataset.
 */
export const PREPAINT = `(function(){
var r=document.documentElement,p={},raw=null;
function ok(v,l,d){return typeof v==="string"&&l.indexOf(v)>=0?v:d}
try{raw=localStorage.getItem("delt-prefs");var v=raw?JSON.parse(raw):null;if(v&&typeof v==="object"&&!Array.isArray(v))p=v;
if(!raw){var lk=localStorage.getItem("delt-look"),lt=localStorage.getItem("delt-theme");if(lk)p={look:lk==="glyph"?"glyph":"minimal"};if(lt==="dark"||lt==="light")p.mode=lt}}catch(e){}
var m=ok(p.mode,["light","dark","auto"],"light");
if(m==="auto")m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
r.dataset.look=ok(p.look,["minimal","glyph"],"minimal");r.dataset.theme=m;
r.dataset.accent=ok(p.accent,["auto","purple","blue","green","red","gold"],"auto");
r.dataset.size=ok(p.size,["normal","large"],"normal");
r.dataset.density=ok(p.density,["comfortable","compact"],"comfortable");
})()`;
