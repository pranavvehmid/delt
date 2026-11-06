// #71: dark mail that stays readable. Instead of inverting the whole mail (which turns grey text
// dark grey on black, flips dark mails white and shifts colours), each element is recoloured:
// light backgrounds become the theme's own dark background, and every text colour keeps its hue
// but gets light enough to pass 4.5:1 on the background it actually sits on. Pictures are untouched.

export type RGB = [number, number, number];

/** "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "rgb(1 2 3 / 50%)" -> [r, g, b, alpha]; null if not rgb() */
export function parseColor(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl([h, s, l]: [number, number, number]): RGB {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as RGB;
}
export const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

/** Mix a translucent colour onto what's behind it. */
export const over = (c: [number, number, number, number], under: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(under[i] + c[3] * (c[i] - under[i]))) as RGB;

/** A background in dark mode: light ones become the page's dark colour (keeping a hint of their
 *  hue and how light they were relative to each other); dark ones already work and stay. */
export function darkBackground(c: RGB, page: RGB): RGB {
  if (luminance(c) < 0.18) return c;
  const [h, s, l] = toHsl(c), [, , pl] = toHsl(page);
  // white -> the page; light grey -> a step above the page; saturated light colours -> a dark tint
  const nl = Math.min(0.3, pl + (1 - l) * 0.35);
  return fromHsl([h, s * 0.45, nl]);
}

/** A text colour that passes 4.5:1 on `bg`, keeping its hue. Dark text flips light first. */
export function readableText(c: RGB, bg: RGB, min = 4.5): RGB {
  if (contrast(c, bg) >= min) return c;
  const bgDark = luminance(bg) < 0.18;
  const [h] = toHsl(c);
  let [, s, l] = toHsl(c);
  // dark text on a now-dark background: mirror its lightness (black -> near white, #666 -> #999)
  if (bgDark && l < 0.5) l = 1 - l;
  s = Math.min(s, 0.85);
  for (let i = 0; i < 60; i++) {
    const out = fromHsl([h, s, l]);
    if (contrast(out, bg) >= min) return out;
    l = bgDark ? Math.min(1, l + 0.02) : Math.max(0, l - 0.02);
  }
  return bgDark ? [255, 255, 255] : [0, 0, 0];
}

const SKIP = new Set(["IMG", "PICTURE", "VIDEO", "SVG", "CANVAS", "IFRAME", "SCRIPT", "STYLE", "HEAD", "META", "LINK", "TITLE", "BR"]);

/** Recolour a mail's document for a dark theme whose background is `page`. */
export function darkenMail(doc: Document, page: RGB) {
  const win = doc.defaultView;
  if (!win || !doc.body) return;
  const bgOf = new Map<Element, RGB | null>(); // null: on a picture, leave the text as the sender made it
  const all = [doc.body, ...doc.body.querySelectorAll("*")].slice(0, 6000);
  // read every style first (one style pass), then write; reading after each write would restyle the mail each time
  const writes: [HTMLElement, string, string][] = [];
  const keyOf = new Map<Element, string>(); // text that inherits its parent's colour on the same background needs no write of its own
  for (const el of all) {
    if (SKIP.has(el.tagName.toUpperCase()) || !(el instanceof win.HTMLElement)) continue;
    const st = win.getComputedStyle(el);
    const parent: RGB | null = el.parentElement && bgOf.has(el.parentElement) ? bgOf.get(el.parentElement)! : page;
    let bg: RGB | null = parent;
    const raw = parseColor(st.backgroundColor);
    if (raw && raw[3] > 0.05 && parent && el !== doc.body) {
      bg = darkBackground(over(raw, parent), page);
      writes.push([el, "background-color", css(bg)]);
    }
    if (st.backgroundImage.includes("url(")) bg = null;
    bgOf.set(el, bg);
    if (!bg) continue;
    if (st.borderTopStyle !== "none" && parseFloat(st.borderTopWidth) > 0) {
      const b = parseColor(st.borderTopColor);
      if (b && luminance(b.slice(0, 3) as RGB) > 0.3) writes.push([el, "border-color", css(darkBackground(b.slice(0, 3) as RGB, page).map((v) => Math.min(255, v + 24)) as RGB)]);
    }
    const key = `${st.color}|${bg}`;
    keyOf.set(el, key);
    if (el.parentElement && keyOf.get(el.parentElement) === key) continue;
    const fg = parseColor(st.color);
    if (!fg) continue;
    const solid = over(fg, bg);
    const out = readableText(solid, bg);
    if (out.join() !== solid.join()) writes.push([el, "color", css(out)]);
  }
  for (const [el, prop, v] of writes) el.style.setProperty(prop, v, "important");
}
