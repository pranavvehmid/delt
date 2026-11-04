// Draws every animated README picture in assets/ (banner, download, sorting,
// tabs, stats, footer). Pure SVG + CSS, so GitHub plays them inside <img>.
// Run: node tools/make_art.mjs
import { writeFileSync, mkdirSync } from "node:fs";

// ======================= palette =======================
const INK = "#0b0716", ON = "#1b1238", BG = "#120d26", BG2 = "#1d1340", CARD = "#261c45", TXT = "#f7f1e3", MUTED = "#b3a8cf";
const GOLD = "#f5c842", GOLD_D = "#b8862a", GOLD2 = "#ffe6a1", CREAM = "#fff3d1", LAV = "#d9ccff", LILAC = "#b9a2ff", MIST = "#ece6ff", ASH = "#e3dff0", RED = "#ff3b47";
const SPARK = "M29 0c1.6 15 6.4 22.4 29 29-22.6 7-27.4 14.4-29 29-1.6-14.6-6.4-22-29-29C22.6 22.4 27.4 15 29 0z";

// ======================= helpers =======================
let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const f1 = (n) => +n.toFixed(1);

/** Shared <defs>: glow filters, background gradient, dot grid, light-sweep gradient. */
const DEFS = (w, h) => `
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="glowS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="blurBig" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
  <radialGradient id="sky" cx="30%" cy="20%" r="90%"><stop offset="0" stop-color="#2a1a5e"/><stop offset=".55" stop-color="${BG2}"/><stop offset="1" stop-color="${BG}"/></radialGradient>
  <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#f7d26e" opacity=".13"/></pattern>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe089"/><stop offset=".55" stop-color="${GOLD}"/><stop offset="1" stop-color="#e2ad2c"/></linearGradient>`;

const BASE_CSS = `
  .t { font-family: "Arial Black", "Segoe UI Black", Impact, sans-serif; font-weight: 900; }
  .b { font-family: "Segoe UI", Arial, sans-serif; font-weight: 700; }
  .m { font-family: Consolas, "Courier New", monospace; font-weight: 700; }
  .fb { transform-box: fill-box; transform-origin: center; }
  .drift { animation: drift 26s linear infinite; }
  @keyframes drift { to { transform: translate(22px, 44px); } }
  .orb { animation: orb 14s ease-in-out infinite alternate; }
  @keyframes orb { to { transform: translate(120px, 40px) scale(1.2); } }
  .rise { animation: rise linear infinite; }
  @keyframes rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: .9; } 85% { opacity: .7; } 100% { transform: translateY(var(--h)); opacity: 0; } }
  .tw { animation: tw 2.4s ease-in-out infinite; }
  @keyframes tw { 0%, 100% { transform: scale(.55) rotate(0deg); opacity: .5; } 50% { transform: scale(1.1) rotate(45deg); opacity: 1; } }
  .spin { animation: spin 9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pulse { animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.3); } }
  .ping { animation: ping 1.8s ease-out infinite; }
  @keyframes ping { 0% { transform: scale(1); opacity: .8; } 100% { transform: scale(3.2); opacity: 0; } }
  .gw { animation: gw var(--gd, 3s) ease-in-out infinite; }
  @keyframes gw { 0%, 100% { opacity: .45; } 18% { opacity: 1; } 36% { opacity: .45; } }
  .sw { animation: sw var(--sd, 4.5s) cubic-bezier(.4,0,.2,1) infinite; }
  @keyframes sw { 0% { transform: translateX(var(--from)) skewX(-20deg); } 55%, 100% { transform: translateX(var(--to)) skewX(-20deg); } }
  .bob { animation: bob 4s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-8px); } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

const svg = (w, h, label, body, css = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
<defs>${DEFS(w, h)}<style>${BASE_CSS}${css}</style></defs>
${body}
</svg>
`;

/** Night background: gradient, drifting dot grid, two soft colour orbs, rising gold dust. */
function backdrop(w, h, dust = 18) {
  let d = "";
  for (let i = 0; i < dust; i++) {
    const x = f1(rnd() * w), y = f1(h * (0.6 + rnd() * 0.5)), r = f1(1 + rnd() * 2.2);
    const dur = f1(7 + rnd() * 9), delay = f1(-rnd() * 16);
    d += `<circle cx="${x}" cy="${y}" r="${r}" fill="${rnd() > 0.25 ? GOLD : LILAC}" class="rise" style="--h:-${f1(h * 0.9)}px;animation-duration:${dur}s;animation-delay:${delay}s"/>`;
  }
  return `
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<g filter="url(#blurBig)" opacity=".55"><circle cx="${w * 0.2}" cy="${h * 0.3}" r="${h * 0.32}" fill="#5b2fd6" class="orb"/><circle cx="${w * 0.8}" cy="${h * 0.8}" r="${h * 0.28}" fill="#b8862a" class="orb" style="animation-delay:-7s"/></g>
<g class="drift"><rect x="-44" y="-44" width="${w + 88}" height="${h + 88}" fill="url(#grid)"/></g>
<g>${d}</g>`;
}

/** A twinkling four-point sparkle. */
const sparkle = (x, y, s, fill, delay = 0) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="${SPARK}" fill="${fill}" class="fb tw" style="animation-delay:${delay}s" filter="url(#glowS)"/></g>`;

/** An extruded 3D block: stacked darker layers under a face. */
function block(x, y, w, h, r, face, depth = 10, stroke = INK, extra = "") {
  let layers = "";
  for (let i = depth; i > 0; i -= 2) layers += `<rect x="${x + i}" y="${y + i}" width="${w}" height="${h}" rx="${r}" fill="${INK}" opacity="${f1(0.55 + (1 - i / depth) * 0.45)}"/>`;
  return `${layers}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${face}" stroke="${stroke}" stroke-width="3.5" ${extra}/>`;
}

/** A light band sweeping across a rounded area (clipped to it). */
let clipN = 0;
function sweepOver(x, y, w, h, r, dur = 4.5, delay = 0) {
  const id = `clip${clipN++}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
  <g clip-path="url(#${id})"><rect x="${x}" y="${y - 20}" width="${Math.max(90, w * 0.18)}" height="${h + 40}" fill="url(#sweep)" class="sw" style="--from:-${Math.max(90, w * 0.18) + 20}px;--to:${w + 60}px;--sd:${dur}s;animation-delay:${delay}s"/></g>`;
}

// ---------- 5x7 dot-matrix font ----------
const F = {
  A: ["01110","10001","10001","11111","10001","10001","10001"], B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01111","10000","10000","10000","10000","10000","01111"], D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"], F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01111","10000","10000","10011","10001","10001","01111"], H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"], J: ["00111","00010","00010","00010","00010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"], L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"], N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"], P: ["11110","10001","10001","11110","10000","10000","10000"],
  R: ["11110","10001","10001","11110","10100","10010","10001"], S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"], U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","10001","01010","00100"], W: ["10001","10001","10001","10101","10101","11011","10001"],
  X: ["10001","10001","01010","00100","01010","10001","10001"], Y: ["10001","10001","01010","00100","00100","00100","00100"], "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"], "2": ["01110","10001","00001","00010","00100","01000","11111"], "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"], "8": ["01110","10001","10001","01110","10001","10001","01110"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"], ".": ["00000","00000","00000","00000","00000","00000","00100"],
};
const textW = (s, p) => s.length * p * 6 - p;

/**
 * Dot-matrix text with a Nothing-style glyph wave: each dot brightens in turn,
 * left to right, forever. `bounce` makes letters hop in sequence too.
 */
function dotText(text, x0, y0, r, pitch, fill, { wave = 3, bounce = 0, glow = true, waveSpan } = {}) {
  const span = waveSpan ?? textW(text, pitch);
  let out = "";
  [...text].forEach((ch, i) => {
    const g = F[ch] ?? F[" "];
    let d = "";
    g.forEach((row, ry) =>
      [...row].forEach((v, cx) => {
        if (v !== "1") return;
        const gx = i * pitch * 6 + cx * pitch;
        const delay = wave ? f1((gx / span) * wave * 0.6) : 0;
        d += `<circle cx="${cx * pitch}" cy="${ry * pitch}" r="${r}"${wave ? ` class="gw" style="--gd:${wave}s;animation-delay:${delay}s"` : ""}/>`;
      }),
    );
    const hop = bounce ? ` class="hop" style="animation-delay:${f1(i * 0.12)}s;--hd:${bounce}s"` : "";
    out += `<g transform="translate(${f1(x0 + i * pitch * 6)} ${y0})"><g${hop} fill="${fill}"${glow ? ' filter="url(#glowS)"' : ""}>${d}</g></g>`;
  });
  return out;
}
const HOP_CSS = `
  .hop { animation: hop var(--hd, 6s) cubic-bezier(.3,1.5,.6,1) infinite; }
  @keyframes hop { 0%, 12%, 100% { transform: translateY(0); } 4% { transform: translateY(-14px); } 8% { transform: translateY(3px); } }`;

mkdirSync("assets", { recursive: true });

// =====================================================================
// 1. BANNER
// =====================================================================
{
  const W = 1200, H = 520;
  clipN = 0;
  const cards = [
    { fill: LILAC, tag: "HACKATHON", lines: ["HackVIT 2026", "registrations", "close Friday"], dir: 1 },
    { fill: ASH, tag: "PROMO", lines: ["Merch sale", "50% off", "today only"], dir: -1 },
    { fill: GOLD, tag: "EXAM", lines: ["CAT-1 exam", "schedule is", "out now"], dir: 1 },
  ];
  const cyc = 9;
  let css = HOP_CSS;
  const deck = cards
    .map((c, i) => {
      // each card: rises to the top, waits, flies off; others queue behind
      const a = (i / 3) * 100, b = ((i + 1) / 3) * 100;
      const flyX = c.dir * 330, rot = c.dir * 22;
      css += `
  .card${i} { animation: card${i} ${cyc}s cubic-bezier(.5,0,.3,1) infinite; }
  @keyframes card${i} {
    0% { transform: ${i === 0 ? "translate(0,0) rotate(0)" : `translate(0, ${i * 14}px) scale(${1 - i * 0.05})`}; opacity: 1; }
    ${f1(a)}% { transform: translate(0,0) rotate(0) scale(1); opacity: 1; }
    ${f1(a + 22)}% { transform: translate(0,0) rotate(0) scale(1); opacity: 1; }
    ${f1(b - 4)}% { transform: translate(${flyX}px, 20px) rotate(${rot}deg); opacity: 0; }
    ${f1(b - 3.9)}%, 99.9% { transform: translate(0, 28px) scale(.9); opacity: 0; }
    100% { transform: ${i === 0 ? "translate(0,0) rotate(0)" : `translate(0, ${i * 14}px) scale(${1 - i * 0.05})`}; opacity: 1; }
  }
  .stamp${i} { opacity: 0; animation: stamp${i} ${cyc}s ease infinite; }
  @keyframes stamp${i} { 0%, ${f1(a + 12)}% { opacity: 0; transform: scale(1.6); } ${f1(a + 17)}%, ${f1(a + 26)}% { opacity: 1; transform: scale(1); } ${f1(a + 30)}%, 100% { opacity: 0; } }`;
      const stamp = c.dir > 0
        ? `<g class="stamp${i} fb"><rect x="18" y="20" width="86" height="30" rx="8" fill="#fff" stroke="#1b8a4a" stroke-width="3" transform="rotate(-12 61 35)"/><text x="61" y="41" text-anchor="middle" class="t" font-size="15" fill="#1b8a4a" transform="rotate(-12 61 35)">READ ✓</text></g>`
        : `<g class="stamp${i} fb"><rect x="70" y="20" width="118" height="30" rx="8" fill="#fff" stroke="#1b8a4a" stroke-width="3" transform="rotate(12 129 35)"/><text x="129" y="41" text-anchor="middle" class="t" font-size="14" fill="#1b8a4a" transform="rotate(12 129 35)">DONE ✓</text></g>`;
      return `<g class="card${i}" style="transform-origin: 98px 220px">
        <rect x="5" y="5" width="196" height="200" rx="18" fill="${INK}"/>
        <rect width="196" height="200" rx="18" fill="${c.fill}" stroke="${INK}" stroke-width="3"/>
        <rect x="14" y="14" width="${c.tag.length * 8 + 20}" height="18" rx="5" fill="${ON}"/><text x="24" y="27" class="m" font-size="10" fill="#fff">${c.tag}</text>
        ${c.lines.map((l, k) => `<text x="14" y="${64 + k * 23}" class="b" font-size="18" fill="${ON}">${l}</text>`).join("")}
        <rect x="14" y="140" width="150" height="8" rx="4" fill="${ON}" opacity=".18"/><rect x="14" y="156" width="110" height="8" rx="4" fill="${ON}" opacity=".18"/>
        <text x="14" y="188" class="m" font-size="10" fill="${ON}" opacity=".7">Office of SW</text>
        ${stamp}
      </g>`;
    })
    .reverse()
    .join("");
  // unread counter ticks 11 -> 10 -> 9 with the deck
  css += `
  .n0 { animation: n0 ${cyc}s steps(1) infinite; } @keyframes n0 { 0%, 29% { opacity: 1; } 30%, 100% { opacity: 0; } }
  .n1 { animation: n1 ${cyc}s steps(1) infinite; } @keyframes n1 { 0%, 29% { opacity: 0; } 30%, 62% { opacity: 1; } 63%, 100% { opacity: 0; } }
  .n2 { animation: n2 ${cyc}s steps(1) infinite; } @keyframes n2 { 0%, 62% { opacity: 0; } 63%, 96% { opacity: 1; } 97%, 100% { opacity: 0; } }
  .sway { animation: sway 7s ease-in-out infinite; transform-origin: 1008px 260px; }
  @keyframes sway { 0%, 100% { transform: rotate(-2.5deg) translateY(0); } 50% { transform: rotate(2.5deg) translateY(-10px); } }
  .scan { animation: scan 4.5s ease-in-out infinite; } @keyframes scan { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(470px); } }
  .chip { animation: chip 3.6s ease-in-out infinite; } @keyframes chip { 50% { transform: translateY(-6px); } }
  .heroB { animation: heroB 6s ease-in-out infinite; } @keyframes heroB { 50% { transform: translateY(-5px); } }`;

  const chips = [
    [84, "11", "unread"],
    [232, "3", "deadlines"],
    [404, "5", "urgent"],
  ]
    .map(([x, n, l], i) => {
      const w = 40 + l.length * 9.5 + n.length * 14;
      return `<g transform="translate(${x} 362)"><g class="chip" style="animation-delay:${i * 0.4}s">
        <rect x="4" y="4" width="${w}" height="42" rx="21" fill="${ON}"/>
        <rect width="${w}" height="42" rx="21" fill="#fff" stroke="${ON}" stroke-width="2.5"/>
        <text x="16" y="29" class="t" font-size="21" fill="${ON}">${n}</text>
        <text x="${26 + n.length * 14}" y="28" class="b" font-size="16" fill="${ON}">${l}</text></g></g>`;
    })
    .join("");

  const tabBar = ["Inbox", "Deadlines"]
    .map((t, i) => {
      const on = i === 0;
      return `<g transform="translate(${62 + i * 112} 0)">${on ? `<rect x="-18" y="-13" width="36" height="21" rx="10" fill="${GOLD}" stroke="${INK}" stroke-width="2" filter="url(#glowS)"/>` : ""}<circle cx="0" cy="-3" r="4" fill="${on ? ON : "#8f86b0"}"/><text x="0" y="21" text-anchor="middle" class="b" font-size="9" fill="${on ? TXT : "#8f86b0"}">${t}</text></g>`;
    })
    .join("");

  const body = `
${backdrop(W, H, 22)}

<!-- gold hero block: extruded, glowing, with a light sweep -->
<g class="heroB">
  <rect x="40" y="40" width="720" height="412" rx="30" fill="${GOLD}" opacity=".35" filter="url(#blurBig)"/>
  ${block(46, 46, 720, 412, 30, "url(#goldG)", 14)}
  ${sweepOver(46, 46, 720, 412, 30, 5, 0.6)}
  <text x="84" y="98" class="m" font-size="15" fill="${ON}" letter-spacing="1.5">VIT VELLORE · YOUR INBOX, SORTED</text>
  ${dotText("DELT", 84, 128, 9.5, 24, ON, { wave: 3.2, bounce: 6, glow: false })}
  <g transform="translate(640 272)"><circle r="13" fill="${RED}" class="fb ping"/><circle r="13" fill="${RED}" class="fb pulse" filter="url(#glowS)"/></g>
  <text x="84" y="340" class="m" font-size="17" fill="${ON}" letter-spacing="1">DON'T JUST READ MAIL. DELT WITH IT.</text>
  ${chips}
  <g transform="translate(84 430)"><rect width="600" height="7" rx="3.5" fill="${ON}" opacity=".18"/><rect width="130" height="7" rx="3.5" fill="${ON}" class="scan"/></g>
  ${sparkle(674, 74, 1, ON, 0)}${sparkle(628, 156, 0.45, ON, 0.8)}
</g>

<!-- phone: extruded, glowing, swaying; the deck keeps dealing -->
<g class="sway">
  <ellipse cx="1010" cy="486" rx="120" ry="14" fill="#000" opacity=".45" filter="url(#glowS)"/>
  <rect x="868" y="36" width="276" height="440" rx="42" fill="${LILAC}" opacity=".28" filter="url(#blurBig)"/>
  ${block(870, 34, 270, 440, 40, BG, 12)}
  <rect x="966" y="48" width="78" height="9" rx="4.5" fill="${INK}"/>
  <text x="892" y="92" class="t" font-size="22" fill="${TXT}">INBOX</text>
  <g class="m" font-size="11" fill="${MUTED}">
    <text x="978" y="91" class="n0">11 unread</text><text x="978" y="91" class="n1">10 unread</text><text x="978" y="91" class="n2">9 unread</text>
  </g>
  <g transform="translate(906 110)">${deck}</g>
  <g transform="translate(906 344)">
    <rect x="0" y="0" width="94" height="34" rx="12" fill="${CARD}" stroke="${INK}" stroke-width="2.5"/><text x="47" y="22" text-anchor="middle" class="b" font-size="12" fill="${TXT}">← Done</text>
    <rect x="108" y="0" width="90" height="34" rx="12" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/><text x="153" y="22" text-anchor="middle" class="b" font-size="12" fill="${ON}">Read →</text>
  </g>
  <g transform="translate(888 424)"><rect x="0" y="-22" width="236" height="46" rx="23" fill="${CARD}" stroke="${INK}" stroke-width="2.5"/>${tabBar}</g>
</g>
${sparkle(1150, 470, 0.5, GOLD, 0.3)}${sparkle(820, 30, 0.38, LILAC, 1.2)}`;
  writeFileSync("assets/banner.svg", svg(W, H, "DELT: your VIT inbox, sorted. Animated cover.", body, css));
}

// =====================================================================
// 2. DOWNLOAD BUTTON: tapped on a loop, sinks, ripples, bursts sparks
// =====================================================================
{
  const W = 1200, H = 230;
  clipN = 0;
  const bw = 780, bh = 112, bx = (W - bw) / 2, by = 46, depth = 14;
  const label = "DOWNLOAD DELT.APK";
  const pitch = 5.4;
  const tw = textW(label, pitch);
  const cyc = 3.2;
  let sparks = "";
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const dx = f1(Math.cos(ang) * (bw / 2 + 40)), dy = f1(Math.sin(ang) * (bh / 2 + 34));
    sparks += `<circle cx="${W / 2}" cy="${by + bh / 2}" r="${i % 2 ? 3 : 4.5}" fill="${i % 3 ? GOLD : LILAC}" class="burst" style="--dx:${dx}px;--dy:${dy}px" filter="url(#glowS)"/>`;
  }
  const css = HOP_CSS + `
  .press { animation: press ${cyc}s cubic-bezier(.3,1.4,.6,1) infinite; }
  @keyframes press { 0%, 62%, 100% { transform: translate(0,0); } 68% { transform: translate(${depth - 3}px, ${depth - 3}px); } 76% { transform: translate(-2px,-3px); } 84% { transform: translate(0,0); } }
  .aura { animation: aura ${cyc}s ease-in-out infinite; transform-origin: ${W / 2}px ${by + bh / 2}px; }
  @keyframes aura { 0%, 60%, 100% { opacity: .35; transform: scale(1); } 70% { opacity: .9; transform: scale(1.08); } }
  .ripple { opacity: 0; animation: ripple ${cyc}s ease-out infinite; transform-origin: ${W / 2}px ${by + bh / 2}px; }
  @keyframes ripple { 0%, 66% { opacity: 0; transform: scale(1); } 68% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(1.35, 1.9); } }
  .burst { opacity: 0; animation: burst ${cyc}s ease-out infinite; }
  @keyframes burst { 0%, 67% { opacity: 0; transform: translate(0,0) scale(.4); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1); } }
  .arrow { animation: arrow 1.1s ease-in-out infinite; } @keyframes arrow { 0%, 100% { transform: translateY(-4px); } 50% { transform: translateY(5px); } }
  .finger { animation: finger ${cyc}s cubic-bezier(.5,0,.3,1) infinite; }
  @keyframes finger { 0%, 40% { transform: translate(120px, 90px); opacity: 0; } 52% { opacity: 1; } 64% { transform: translate(0,0); opacity: 1; } 70% { transform: translate(6px, 6px); } 86% { transform: translate(40px, 60px); opacity: 0; } 100% { opacity: 0; } }`;
  const body = `
${backdrop(W, H, 16)}
<rect x="${bx - 30}" y="${by - 24}" width="${bw + 60}" height="${bh + 48}" rx="80" fill="${GOLD}" class="aura" filter="url(#blurBig)"/>
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="56" fill="none" stroke="${GOLD}" stroke-width="4" class="ripple"/>
${sparks}
<!-- base (the button sinks into it) -->
${Array.from({ length: depth / 2 }, (_, k) => `<rect x="${bx + depth - k * 2}" y="${by + depth - k * 2}" width="${bw}" height="${bh}" rx="56" fill="${k === 0 ? "#000" : "#6e4c12"}" opacity="${k === 0 ? 0.6 : 1}"/>`).join("")}
<g class="press">
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="56" fill="url(#goldG)" stroke="${INK}" stroke-width="4.5"/>
  <rect x="${bx + 34}" y="${by + 12}" width="${bw - 68}" height="16" rx="8" fill="#fff" opacity=".35"/>
  ${sweepOver(bx, by, bw, bh, 56, cyc, 0)}
  <g transform="translate(${bx + 54} ${by + 26})">
    <circle cx="30" cy="30" r="32" fill="${ON}"/>
    <g class="arrow"><path d="M30 13 v28 M18 30 l12 12 12-12" stroke="${GOLD}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 49 h28" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/></g>
  </g>
  ${dotText(label, bx + 140, by + 37, 2.2, pitch, ON, { wave: 2.4, glow: false })}
  <g transform="translate(${bx + 140 + tw + 18} ${by + 37 + 6 * pitch})"><circle r="6" fill="${RED}" class="fb pulse"/></g>
</g>
<!-- a finger taps the button -->
<g transform="translate(${bx + bw - 140} ${by + 60})"><g class="finger">
  <path d="M10 0 c6 0 10 4 10 10 v26 l10-2 c6-1 10 3 10 8 v4 l6-1 c5-1 9 3 9 8 v18 c0 16-12 28-28 28 h-6 c-12 0-22-8-25-20 l-8-28 c-2-6 4-10 9-6 l6 6 V10 C-6 4-2 0 10 0z" fill="#fff" stroke="${INK}" stroke-width="3"/>
</g></g>
<text x="${W / 2}" y="${H - 18}" text-anchor="middle" class="m" font-size="15" fill="${MUTED}" letter-spacing="1.5">ANDROID 8+ · 400 KB · FREE · TAP, INSTALL, SIGN IN WITH VIT</text>
${sparkle(bx - 80, by + 28, 0.62, GOLD, 0)}${sparkle(bx + bw + 30, by + 22, 0.44, LILAC, 0.9)}`;
  writeFileSync("assets/download.svg", svg(W, H, "Download DELT.apk", body, css));
}

// =====================================================================
// 3. SORTING: scanner reads each mail; several fly at once; piles bump and count
// =====================================================================
{
  const W = 1200, H = 470;
  clipN = 0;
  const piles = [
    { x: 80, fill: GOLD, name: "URGENT", sub: "exams · FFCS · fees · deadlines", counts: ["12", "13", "14"] },
    { x: 360, fill: CREAM, name: "PRIORITY", sub: "notices · timetable · hostel", counts: ["8", "9", "9"] },
    { x: 640, fill: MIST, name: "LATER", sub: "events · talks · scholarships", counts: ["41", "42", "43"] },
    { x: 920, fill: ASH, name: "NOISE", sub: "sales · promos · not for you", counts: ["6", "6", "7"] },
  ];
  const mails = [
    { t: ["CAT-1", "schedule"], p: 0, fill: GOLD },
    { t: ["Guest", "lecture"], p: 2, fill: MIST },
    { t: ["Mess", "change"], p: 1, fill: CREAM },
    { t: ["Merch", "sale 50%"], p: 3, fill: ASH },
    { t: ["HackVIT", "closes Fri"], p: 0, fill: LILAC },
    { t: ["Congrats", "Team X"], p: 2, fill: MIST },
    { t: ["Fee due", "15 Nov"], p: 0, fill: GOLD2 },
    { t: ["Club", "newsletter"], p: 2, fill: LAV },
    { t: ["Holiday", "notice"], p: 1, fill: CREAM },
    { t: ["Coursera", "offer"], p: 3, fill: ASH },
  ];
  const cyc = 10, slot = cyc / mails.length;
  const sx = 880, sy = 150; // where mail leaves the scanner
  let css = `
  .beam { animation: beam ${slot}s ease-in-out infinite; } @keyframes beam { 0%, 100% { transform: translateY(0); opacity: .9; } 50% { transform: translateY(54px); opacity: 1; } }
  .chute { animation: chute ${slot}s ease-in-out infinite; } @keyframes chute { 50% { transform: translateY(-3px); } }`;
  const flights = mails
    .map((m, i) => {
      const p = piles[m.p];
      const tx = f1(p.x + 50 - sx), ty = 238;
      const midX = f1(tx * 0.5), midY = -60;
      css += `
  .fly${i} { opacity: 0; animation: fly ${cyc}s cubic-bezier(.45,0,.3,1) infinite; animation-delay: ${f1(i * slot)}s; --tx:${tx}px; --mx:${midX}px; }`;
      return `<g transform="translate(${sx} ${sy})"><g class="fly${i}">
        <g transform="translate(-80 -30)">
          <rect x="4" y="4" width="160" height="58" rx="12" fill="${INK}"/>
          <rect width="160" height="58" rx="12" fill="${m.fill}" stroke="${INK}" stroke-width="3"/>
          <path d="M12 14 l22 14 22-14" stroke="${ON}" stroke-width="3" fill="none"/>
          <text x="62" y="26" class="b" font-size="13" fill="${ON}">${m.t[0]}</text><text x="62" y="44" class="b" font-size="13" fill="${ON}">${m.t[1]}</text>
        </g>
      </g></g>`;
    })
    .join("");
  css += `
  @keyframes fly {
    0% { transform: translate(0, -70px) scale(.7); opacity: 0; }
    6% { transform: translate(0, 0) scale(1); opacity: 1; }
    12% { transform: translate(0, 0) scale(1); opacity: 1; }
    24% { transform: translate(var(--mx), -20px) rotate(-6deg) scale(.9); opacity: 1; }
    36% { transform: translate(var(--tx), 238px) rotate(4deg) scale(.62); opacity: 1; }
    40%, 100% { transform: translate(var(--tx), 248px) scale(.5); opacity: 0; }
  }`;
  // each pile bumps when its mail lands, and its count ticks
  const pileSvg = piles
    .map((p, pi) => {
      const lands = mails.map((m, i) => (m.p === pi ? (((i * slot + cyc * 0.36) % cyc) / cyc) * 100 : null)).filter((v) => v !== null);
      const kf = lands.map((l) => `${f1(l)}% { transform: translateY(0) scale(1); } ${f1(l + 1.5)}% { transform: translateY(6px) scale(1.04, .94); } ${f1(l + 4)}% { transform: translateY(0) scale(1); }`).join(" ");
      css += `
  .pile${pi} { animation: pile${pi} ${cyc}s ease-out infinite; transform-box: fill-box; transform-origin: center bottom; }
  @keyframes pile${pi} { 0%, 100% { transform: none; } ${kf} }
  .glow${pi} { animation: glowp${pi} ${cyc}s ease-out infinite; }
  @keyframes glowp${pi} { 0%, 100% { opacity: .15; } ${lands.map((l) => `${f1(l)}% { opacity: .15; } ${f1(l + 1.5)}% { opacity: .9; } ${f1(l + 7)}% { opacity: .15; }`).join(" ")} }`;
      return `
    <g transform="translate(${p.x} 340)">
      <rect x="-10" y="-10" width="220" height="130" rx="26" fill="${p.fill}" class="glow${pi}" filter="url(#blurBig)"/>
      <g class="pile${pi}">
        ${block(0, 0, 200, 110, 20, p.fill, 10)}
        ${dotText(p.name, 16, 20, 1.5, 3.1, ON, { wave: 2.8, glow: false })}
        <text x="16" y="88" class="m" font-size="11" fill="${ON}" opacity=".75">${p.sub}</text>
        <g transform="translate(182 26)"><circle r="13" fill="${ON}"/><text y="5" text-anchor="middle" class="t" font-size="13" fill="${p.fill}">${p.counts[2]}</text></g>
      </g>
    </g>`;
    })
    .join("");
  const body = `
${backdrop(W, H, 18)}
${dotText("HOW DELT SORTS", 60, 34, 2.6, 6.2, TXT, { wave: 3.4 })}
<text x="60" y="108" class="m" font-size="14" fill="${MUTED}">free rules first · AI only when unsure · your corrections always win</text>
<!-- scanner: the inbox with a reading beam -->
<g class="chute">
  <rect x="${sx - 120}" y="${sy - 70}" width="240" height="132" rx="24" fill="${LILAC}" opacity=".25" filter="url(#blurBig)"/>
  ${block(sx - 110, sy - 62, 220, 118, 22, CARD, 10)}
  <text x="${sx}" y="${sy - 76}" text-anchor="middle" class="m" font-size="12" fill="${GOLD}" letter-spacing="1.5">YOUR VIT INBOX</text>
  <g class="beam"><rect x="${sx - 100}" y="${sy - 52}" width="200" height="4" rx="2" fill="${GOLD}" filter="url(#glow)"/></g>
</g>
${flights}
${pileSvg}
${sparkle(1120, 150, 0.5, GOLD, 0.2)}${sparkle(300, 200, 0.32, LILAC, 1)}`;
  writeFileSync("assets/sorting.svg", svg(W, H, "How DELT sorts: mail is read and dropped into Urgent, Priority, Later or Noise", body, css));
}

// =====================================================================
// 4. HOW IT WORKS: three cards (inbox, mail, deadlines), each animating its job
// =====================================================================
{
  const W = 1200, H = 360;
  clipN = 0;
  const cyc = 10;
  const PILE_DOTS = ["#ff6369", GOLD, LILAC, "#8e8c99"];
  const minis = [
    // Inbox: rows slide in, each with its pile colour
    `<g transform="translate(24 116)">${[0, 1, 2, 3].map((k) => `<g class="row" style="animation-delay:${k * 0.35}s"><circle cx="8" cy="${k * 22 + 8}" r="7" fill="${PILE_DOTS[k]}" stroke="${INK}" stroke-width="1.5"/><rect x="24" y="${k * 22 + 2}" width="${[200, 150, 180, 120][k]}" height="7" rx="3.5" fill="currentColor" opacity=".55"/><rect x="24" y="${k * 22 + 11}" width="${[140, 110, 90, 150][k]}" height="5" rx="2.5" fill="currentColor" opacity=".25"/></g>`).join("")}</g>`,
    // Full mail: text lines write themselves, pile chips below
    `<g transform="translate(24 116)">${[0, 1, 2, 3].map((k) => `<rect y="${k * 14}" width="${[260, 230, 250, 140][k]}" height="6" rx="3" fill="currentColor" opacity=".45" class="type" style="animation-delay:${k * 0.4}s"/>`).join("")}${["Urgent", "Priority", "Later"].map((p, k) => `<g transform="translate(${k * 78} 68)"><rect width="70" height="22" rx="11" fill="${k === 0 ? "#ff6369" : "none"}" stroke="currentColor" stroke-width="1.5" class="${k === 0 ? "pick" : ""}"/><text x="35" y="15" text-anchor="middle" class="b" font-size="11">${p}</text></g>`).join("")}</g>`,
    // Deadlines: a clock with spinning hands
    `<g transform="translate(70 152)"><circle r="34" fill="none" stroke="currentColor" stroke-width="3"/>${Array.from({ length: 12 }, (_, k) => `<circle cx="${f1(Math.cos((k / 12) * 6.283) * 27)}" cy="${f1(Math.sin((k / 12) * 6.283) * 27)}" r="1.8" fill="currentColor"/>`).join("")}<line y2="-22" stroke="${RED}" stroke-width="3.5" stroke-linecap="round" class="hand1"/><line y2="-14" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="hand2"/><circle r="4" fill="currentColor"/></g>
     <g transform="translate(130 128)">${["Today", "Tomorrow", "This week"].map((d, k) => `<g class="row" style="animation-delay:${k * 0.4}s"><text y="${k * 22 + 10}" class="m" font-size="12" fill="${k === 0 ? RED : "currentColor"}">${d}</text></g>`).join("")}</g>`,
  ];
  const tabs = [
    { name: "INBOX", line: "every mail in one list", sub: "colour tag = pile · swipe to act" },
    { name: "MAIL", line: "tap to read it all", sub: "full mail · move pile · calendar" },
    { name: "DEADLINES", line: "found in your mail", sub: "overdue · today · this week" },
  ];
  const N = tabs.length, CW = 360;
  let css = HOP_CSS + `
  .tick { stroke-dasharray: 16; animation: tick 2.4s ease-in-out infinite; } @keyframes tick { 0%, 15% { stroke-dashoffset: 16; } 35%, 85% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 16; } }
  .mswipe { animation: mswipe 2.6s cubic-bezier(.5,0,.3,1) infinite; } @keyframes mswipe { 0%, 30% { transform: translate(0,0) rotate(0); opacity: 1; } 60% { transform: translate(120px, 6px) rotate(14deg); opacity: 0; } 61% { transform: translate(0, 10px); opacity: 0; } 85%, 100% { transform: translate(0,0); opacity: 1; } }
  .hand1 { animation: spin 3s linear infinite; } .hand2 { animation: spin 18s linear infinite; }
  .type { transform-box: fill-box; transform-origin: left; animation: type 3s ease-out infinite; } @keyframes type { 0% { transform: scaleX(0); } 30%, 85% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
  .pick { animation: pick 3s ease-in-out infinite; } @keyframes pick { 0%, 40% { opacity: 0; } 55%, 100% { opacity: 1; } }
  .row { animation: row 3s cubic-bezier(.3,1.3,.6,1) infinite; } @keyframes row { 0% { transform: translateX(-30px); opacity: 0; } 20%, 80% { transform: none; opacity: 1; } 100% { opacity: 0; } }`;
  const cards = tabs
    .map((t, i) => {
      const x = 34 + i * (CW + 26);
      const s = (i / N) * 100, e = ((i + 1) / N) * 100;
      css += `
  .lit${i} { animation: lit${i} ${cyc}s ease-in-out infinite; } @keyframes lit${i} { 0%, ${f1(s)}% { fill: ${CARD}; } ${f1(s + 3)}%, ${f1(e - 2)}% { fill: ${GOLD}; } ${f1(e)}%, 100% { fill: ${CARD}; } }
  .col${i} { animation: col${i} ${cyc}s ease-in-out infinite; color: ${TXT}; } @keyframes col${i} { 0%, ${f1(s)}% { color: ${TXT}; } ${f1(s + 3)}%, ${f1(e - 2)}% { color: ${ON}; } ${f1(e)}%, 100% { color: ${TXT}; } }
  .lift${i} { animation: lift${i} ${cyc}s cubic-bezier(.3,1.4,.6,1) infinite; } @keyframes lift${i} { 0%, ${f1(s)}% { transform: none; } ${f1(s + 3)}%, ${f1(e - 2)}% { transform: translate(-5px,-10px); } ${f1(e)}%, 100% { transform: none; } }
  .halo${i} { opacity: 0; animation: halo${i} ${cyc}s ease-in-out infinite; } @keyframes halo${i} { 0%, ${f1(s)}% { opacity: 0; } ${f1(s + 3)}%, ${f1(e - 2)}% { opacity: .8; } ${f1(e)}%, 100% { opacity: 0; } }`;
      return `
  <g transform="translate(${x} 100)">
    <rect x="-8" y="-8" width="${CW + 16}" height="236" rx="30" fill="${GOLD}" class="halo${i}" filter="url(#blurBig)"/>
    ${Array.from({ length: 5 }, (_, k) => `<rect x="${10 - k * 2}" y="${10 - k * 2}" width="${CW}" height="220" rx="24" fill="${INK}" opacity="${f1(0.55 + k * 0.1)}"/>`).join("")}
    <g class="lift${i}">
      <rect width="${CW}" height="220" rx="24" class="lit${i}" stroke="${INK}" stroke-width="3.5"/>
      ${sweepOver(0, 0, CW, 220, 24, 5, i * 0.7)}
      <g class="col${i}" fill="currentColor">
        <text x="24" y="52" class="t" font-size="27">${t.name}</text>
        <text x="${CW - 24}" y="40" text-anchor="end" class="t" font-size="20" opacity=".3">${i + 1}</text>
        <text x="24" y="80" class="b" font-size="14">${t.line}</text>
        <text x="24" y="100" class="m" font-size="11" opacity=".8">${t.sub}</text>
        ${minis[i]}
      </g>
    </g>
  </g>`;
    })
    .join("");
  const body = `
${backdrop(W, H, 16)}
${dotText("ONE INBOX. EVERY MAIL.", 34, 30, 2.5, 6, TXT, { wave: 3.6 })}
${cards}`;
  writeFileSync("assets/tabs.svg", svg(W, H, "One inbox with every mail, the full mail on tap, and deadlines from mail", body, css));
}

// =====================================================================
// 5. STATS: extruded cards that float, glow and sweep; numbers shimmer
// =====================================================================
{
  const W = 1200, H = 200;
  clipN = 0;
  const stats = [
    { big: "151", label: "TESTS PASSING", fill: GOLD, bars: [0.4, 0.7, 0.9, 1] },
    { big: "14", label: "REPOS STUDIED", fill: LILAC, bars: [0.6, 0.3, 0.8, 0.5] },
    { big: "3000", label: "RANDOM MAILS · 0 CRASHES", fill: CREAM, bars: [0.9, 0.95, 1, 0.98] },
    { big: "0", label: "RUPEES TO RUN", fill: MIST, bars: [0.05, 0.05, 0.05, 0.05] },
  ];
  let css = `
  .float { animation: float 5s ease-in-out infinite; } @keyframes float { 50% { transform: translateY(-7px); } }
  .bar { transform-box: fill-box; transform-origin: bottom; animation: bar 2.4s cubic-bezier(.3,1.4,.6,1) infinite; } @keyframes bar { 0% { transform: scaleY(.1); } 40%, 85% { transform: scaleY(1); } 100% { transform: scaleY(.1); } }`;
  const cells = stats
    .map((s, i) => {
      const x = 28 + i * 290;
      return `
  <g transform="translate(${x} 30)"><g class="float" style="animation-delay:${-i * 1.2}s">
    <rect x="-6" y="-6" width="282" height="140" rx="26" fill="${s.fill}" opacity=".3" filter="url(#blurBig)"/>
    ${block(0, 0, 270, 128, 22, s.fill, 10)}
    ${sweepOver(0, 0, 270, 128, 22, 4.5, i * 0.9)}
    ${dotText(s.big, 22, 20, 2.8, 6.4, ON, { wave: 2.6, glow: false })}
    <text x="22" y="110" class="m" font-size="12.5" fill="${ON}" letter-spacing=".5">${s.label}</text>
    <g transform="translate(206 26)">${s.bars.map((b, k) => `<rect x="${k * 13}" y="${f1(50 - 50 * b)}" width="9" height="${f1(Math.max(2, 50 * b))}" rx="3" fill="${ON}" opacity=".75" class="bar" style="animation-delay:${k * 0.15 + i * 0.3}s"/>`).join("")}</g>
    ${i === 0 ? `<g transform="translate(250 112)"><circle r="6" fill="${RED}" class="fb ping"/><circle r="6" fill="${RED}"/></g>` : ""}
  </g></g>`;
    })
    .join("");
  writeFileSync("assets/stats.svg", svg(W, H, "151 tests passing · 14 repos studied · 3000 random mails, 0 crashes · 0 rupees to run", `${backdrop(W, H, 12)}${cells}`, css));
}

// =====================================================================
// 6. FOOTER: glyph-light ring + bar, waving dot text
// =====================================================================
{
  const W = 1200, H = 200;
  clipN = 0;
  const label = "MADE FOR VITIANS";
  const pitch = 5.8;
  const tw = textW(label, pitch);
  const ringN = 36, R = 46, cx = 120, cy = 100;
  const ring = Array.from({ length: ringN }, (_, k) => {
    const a = (k / ringN) * Math.PI * 2;
    return `<circle cx="${f1(cx + Math.cos(a) * R)}" cy="${f1(cy + Math.sin(a) * R)}" r="3.4" fill="${GOLD}" class="ringd" style="animation-delay:${f1((k / ringN) * 2.4)}s"/>`;
  }).join("");
  const ring2 = ring.split(`cx="`).join(`cx="`).replace(/cx="([\d.]+)"/g, (_, v) => `cx="${f1(W - 2 * cx + Number(v))}"`);
  const css = `
  .ringd { opacity: .15; animation: ringd 2.4s linear infinite; } @keyframes ringd { 0% { opacity: 1; } 40%, 100% { opacity: .12; } }
  .scan { animation: scan 4.6s ease-in-out infinite; } @keyframes scan { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(${tw - 140}px); } }`;
  const tx = (W - tw) / 2;
  const body = `
${backdrop(W, H, 14)}
<g filter="url(#glowS)">${ring}${ring2}</g>
${dotText(label, tx, 52, 2.6, pitch, GOLD, { wave: 2.8, bounce: 7 })}
<g transform="translate(${tx + tw + 20} ${52 + 6 * pitch})"><circle r="6.5" fill="${RED}" class="fb ping"/><circle r="6.5" fill="${RED}" class="fb pulse"/></g>
<g transform="translate(${tx} 132)"><rect width="${tw}" height="7" rx="3.5" fill="${TXT}" opacity=".1"/><rect width="140" height="7" rx="3.5" fill="${GOLD}" class="scan" filter="url(#glow)"/></g>
<text x="${W / 2}" y="174" text-anchor="middle" class="m" font-size="12" fill="${MUTED}" letter-spacing="2">FREE · OPEN SOURCE · NEVER DELETES YOUR MAIL</text>`;
  writeFileSync("assets/footer.svg", svg(W, H, "Made for VITians", body, css + HOP_CSS));
}

console.log("assets: banner download sorting tabs stats footer");
