// Draws the animated README pieces in assets/: download button, sorting flow,
// five tabs, stats strip and footer. Run: node tools/make_assets.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const INK = "#0b0716", ON = "#1b1238", BG = "#17112b", CARD = "#261c45", TXT = "#f7f1e3", MUTED = "#b3a8cf";
const GOLD = "#f5c842", GOLD2 = "#ffe6a1", CREAM = "#fff3d1", LAV = "#d9ccff", LILAC = "#b9a2ff", MIST = "#ece6ff", ASH = "#e3dff0", RED = "#d71921";

const STYLE = `
    .t { font-family: "Arial Black", "Segoe UI Black", Impact, sans-serif; font-weight: 900; }
    .b { font-family: "Segoe UI", Arial, sans-serif; font-weight: 700; }
    .m { font-family: Consolas, "Courier New", monospace; font-weight: 700; }
    .pop { transform-box: fill-box; transform-origin: center; animation: pop .5s cubic-bezier(.3,1.4,.6,1) both; }
    @keyframes pop { 0% { opacity: 0; transform: scale(.4); } 65% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
    .float { animation: float 4s ease-in-out infinite; }
    @keyframes float { 50% { transform: translateY(-6px); } }
    .spin { transform-box: fill-box; transform-origin: center; animation: spin 8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 50% { transform: scale(1.3); } }
    .blink { animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: .2; } }
    .drift { animation: drift 24s linear infinite; }
    @keyframes drift { to { transform: translate(22px, 44px); } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;
const GRID = `<pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#f7d26e" opacity=".14"/></pattern>`;
const SPARK = "M29 0c1.6 15 6.4 22.4 29 29-22.6 7-27.4 14.4-29 29-1.6-14.6-6.4-22-29-29C22.6 22.4 27.4 15 29 0z";

const svg = (w, h, label, body, extraStyle = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
<defs>${GRID}<style>${STYLE}${extraStyle}</style></defs>
${body}
</svg>
`;

// 5x7 dot-matrix glyphs for headings
const F = {
  A: ["01110","10001","10001","11111","10001","10001","10001"], B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01111","10000","10000","10000","10000","10000","01111"], D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"], F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01111","10000","10000","10011","10001","10001","01111"], H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"], J: ["00111","00010","00010","00010","00010","10010","01100"], K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"], M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10011","10001","10001","10001"], O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"], R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"], T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"], V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","11011","10001"], Y: ["10001","10001","01010","00100","00100","00100","00100"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"], "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"], "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"], "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "%": ["11001","11010","00010","00100","01000","01011","10011"], "+": ["00000","00100","00100","11111","00100","00100","00000"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"], ".": ["00000","00000","00000","00000","00000","00000","00100"],
};
function dots(text, x0, y0, r, pitch, fill, cls = "", delayStep = 0) {
  let out = "";
  [...text].forEach((ch, i) => {
    const g = F[ch] ?? F[" "];
    let d = "";
    g.forEach((row, ry) => [...row].forEach((v, cx) => { if (v === "1") d += `<circle cx="${cx * pitch}" cy="${ry * pitch}" r="${r}"/>`; }));
    out += `<g transform="translate(${x0 + i * pitch * 6} ${y0})"><g class="${cls}" style="animation-delay:${(i * delayStep).toFixed(2)}s" fill="${fill}">${d}</g></g>`;
  });
  return out;
}
const textWidth = (text, pitch) => text.length * pitch * 6 - pitch;

mkdirSync("assets", { recursive: true });

// ---------- 1. download button ----------
{
  const W = 1200, H = 210;
  const label = "DOWNLOAD DELT.APK";
  const pitch = 5.4, r = 2.2;
  const tw = textWidth(label, pitch);
  const bx = (W - 760) / 2;
  const body = `
<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>
<g class="press">
  <rect x="${bx + 10}" y="46" width="760" height="112" rx="56" fill="${INK}"/>
  <g class="btn">
    <rect x="${bx}" y="36" width="760" height="112" rx="56" fill="${GOLD}" stroke="${INK}" stroke-width="5"/>
    <rect x="${bx + 30}" y="48" width="700" height="14" rx="7" fill="#fff" opacity=".35"/>
    <g transform="translate(${bx + 64} 66)">
      <circle cx="26" cy="26" r="30" fill="${ON}"/>
      <g class="arrow"><path d="M26 10 v26 M15 26 l11 11 11-11" stroke="${GOLD}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 44 h26" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/></g>
    </g>
    ${dots(label, bx + 150, 73, r, pitch, ON, "wave", 0.06)}
    <circle cx="${bx + 150 + tw + 18}" cy="${73 + 6 * pitch}" r="6" fill="${RED}" class="pulse"/>
  </g>
</g>
<text x="${W / 2}" y="186" text-anchor="middle" class="m" font-size="15" fill="${MUTED}" letter-spacing="1.5">ANDROID 8+ · 400 KB · FREE · TAP, INSTALL, SIGN IN WITH VIT</text>
<g transform="translate(${bx - 70} 70)"><path d="${SPARK}" fill="${GOLD}" class="spin" transform="scale(.6)"/></g>
<g transform="translate(${bx + 800} 64)"><path d="${SPARK}" fill="${LILAC}" class="spin" transform="scale(.42)"/></g>`;
  const extra = `
    .btn { animation: bob 2.6s ease-in-out infinite; }
    @keyframes bob { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-3px,-4px); } }
    .arrow { animation: arrow 1.4s ease-in-out infinite; }
    @keyframes arrow { 0%, 100% { transform: translateY(-3px); } 50% { transform: translateY(4px); } }
    .wave { animation: wave 3s ease-in-out infinite; }
    @keyframes wave { 0%, 70%, 100% { transform: translateY(0); } 80% { transform: translateY(-5px); } 90% { transform: translateY(1px); } }`;
  writeFileSync("assets/download.svg", svg(W, H, "Download DELT.apk", body, extra));
}

// ---------- 2. sorting flow: mail drops into four piles ----------
{
  const W = 1200, H = 430;
  const piles = [
    { x: 110, fill: GOLD, name: "URGENT", sub: "exams · FFCS · fees · deadlines" },
    { x: 380, fill: CREAM, name: "PRIORITY", sub: "notices · timetable · hostel" },
    { x: 650, fill: MIST, name: "LATER", sub: "events · talks · scholarships" },
    { x: 920, fill: ASH, name: "NOISE", sub: "sales · promos · not for you" },
  ];
  const mails = [
    { t: "CAT-1 schedule", pile: 0, fill: GOLD },
    { t: "Mess change", pile: 1, fill: CREAM },
    { t: "Guest lecture", pile: 2, fill: MIST },
    { t: "Merch sale 50%", pile: 3, fill: ASH },
    { t: "HackVIT closes Fri", pile: 0, fill: LILAC },
    { t: "Congrats Team X", pile: 2, fill: MIST },
  ];
  const cycle = 12; // seconds for all six
  let css = "";
  const drops = mails
    .map((m, i) => {
      const tx = piles[m.pile].x + 20 - 690;
      const name = `drop${i}`;
      const s = (i / mails.length) * 100, e = s + 100 / mails.length;
      css += `
    .${name} { animation: ${name} ${cycle}s cubic-bezier(.5,0,.3,1) infinite; }
    @keyframes ${name} { 0%, ${s.toFixed(1)}% { transform: translate(0,0) scale(1); opacity: 0; } ${(s + 1).toFixed(1)}% { opacity: 1; } ${(s + 6).toFixed(1)}% { transform: translate(0,0) scale(1); opacity: 1; } ${(e - 2).toFixed(1)}% { transform: translate(${tx}px, 205px) scale(.82); opacity: 1; } ${e.toFixed(1)}%, 100% { transform: translate(${tx}px, 215px) scale(.8); opacity: 0; } }`;
      return `<g class="${name}"><g transform="translate(690 54)">
        <rect x="5" y="5" width="160" height="58" rx="12" fill="${INK}"/>
        <rect width="160" height="58" rx="12" fill="${m.fill}" stroke="${INK}" stroke-width="3"/>
        <path d="M12 14 l22 14 22-14" stroke="${ON}" stroke-width="3" fill="none"/>
        <text x="64" y="26" class="b" font-size="13" fill="${ON}">${m.t.split(" ").slice(0, 2).join(" ")}</text>
        <text x="64" y="44" class="b" font-size="13" fill="${ON}">${m.t.split(" ").slice(2).join(" ")}</text>
      </g></g>`;
    })
    .join("");
  // counters on each pile tick up as mail lands
  const pileSvg = piles
    .map((p, i) => `
    <g transform="translate(${p.x} 290)">
      <rect x="6" y="6" width="200" height="110" rx="20" fill="${INK}"/>
      <rect width="200" height="110" rx="20" fill="${p.fill}" stroke="${INK}" stroke-width="4"/>
      ${dots(p.name, 18, 20, 1.7, 3.9, ON)}
      <text x="18" y="84" class="m" font-size="11" fill="${ON}" opacity=".75">${p.sub}</text>
      <circle cx="182" cy="20" r="6" fill="${i === 0 ? RED : ON}" class="${i === 0 ? "pulse" : ""}" opacity="${i === 0 ? 1 : 0.25}"/>
    </g>`)
    .join("");
  const body = `
<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>
${dots("HOW DELT SORTS", 60, 30, 2.6, 6.2, TXT)}
<text x="60" y="104" class="m" font-size="14" fill="${MUTED}">free rules first · AI only when unsure · your corrections always win</text>
<!-- inbox chute -->
<g transform="translate(670 44)">
  <rect x="6" y="6" width="200" height="86" rx="18" fill="${INK}"/>
  <rect width="200" height="86" rx="18" fill="${CARD}" stroke="${INK}" stroke-width="4"/>
  <text x="100" y="-8" text-anchor="middle" class="m" font-size="12" fill="${GOLD}">YOUR VIT INBOX</text>
</g>
${drops}
${pileSvg}
<g transform="translate(1110 150)"><path d="${SPARK}" fill="${GOLD}" class="spin" transform="scale(.5)"/></g>`;
  writeFileSync("assets/sorting.svg", svg(W, H, "How DELT sorts mail into four piles", body, css));
}

// ---------- 3. five tabs lighting up one by one ----------
{
  const W = 1200, H = 330;
  const tabs = [
    { name: "TODAY", line1: "4-step checklist", line2: "top · due · notices", icon: "M12 3v2m0 14v2M5 12H3m18 0h-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
    { name: "NEW", line1: "swipe unread mail", line2: "→ got it  ← not for me", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
    { name: "CHANCES", line1: "hackathons for you", line2: "ranked by interests", icon: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" },
    { name: "DEADLINES", line1: "yours + from mail", line2: "→ Google Calendar", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
    { name: "INBOX", line1: "every mail by day", line2: "senders · bulk clean", icon: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z" },
  ];
  const cycle = 10;
  let css = "";
  const cards = tabs
    .map((t, i) => {
      const x = 40 + i * 228;
      const s = (i / tabs.length) * 100, e = ((i + 1) / tabs.length) * 100;
      css += `
    .lit${i} { animation: lit${i} ${cycle}s ease-in-out infinite; }
    @keyframes lit${i} { 0%, ${s.toFixed(0)}% { fill: ${CARD}; } ${(s + 3).toFixed(0)}%, ${(e - 2).toFixed(0)}% { fill: ${GOLD}; } ${e.toFixed(0)}%, 100% { fill: ${CARD}; } }
    .lift${i} { animation: lift${i} ${cycle}s cubic-bezier(.3,1.4,.6,1) infinite; }
    @keyframes lift${i} { 0%, ${s.toFixed(0)}% { transform: translate(0,0); } ${(s + 3).toFixed(0)}%, ${(e - 2).toFixed(0)}% { transform: translate(-4px,-8px); } ${e.toFixed(0)}%, 100% { transform: translate(0,0); } }
    .ink${i} { animation: ink${i} ${cycle}s ease-in-out infinite; }
    @keyframes ink${i} { 0%, ${s.toFixed(0)}% { stroke: ${TXT}; } ${(s + 3).toFixed(0)}%, ${(e - 2).toFixed(0)}% { stroke: ${ON}; } ${e.toFixed(0)}%, 100% { stroke: ${TXT}; } }
    .txt${i} { animation: txt${i} ${cycle}s ease-in-out infinite; }
    @keyframes txt${i} { 0%, ${s.toFixed(0)}% { fill: ${TXT}; } ${(s + 3).toFixed(0)}%, ${(e - 2).toFixed(0)}% { fill: ${ON}; } ${e.toFixed(0)}%, 100% { fill: ${TXT}; } }`;
      return `
  <g transform="translate(${x} 92)">
    <rect x="7" y="7" width="208" height="200" rx="24" fill="${INK}"/>
    <g class="lift${i}">
      <rect width="208" height="200" rx="24" class="lit${i}" stroke="${INK}" stroke-width="4"/>
      <g transform="translate(24 24) scale(1.6)" class="ink${i}" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}" fill="none"/></g>
      <text x="24" y="114" class="t txt${i}" font-size="${t.name.length > 7 ? 22 : 26}">${t.name}</text>
      <text x="24" y="146" class="b txt${i}" font-size="14">${t.line1}</text>
      <text x="24" y="168" class="m txt${i}" font-size="11.5" opacity=".8">${t.line2}</text>
      <text x="184" y="44" text-anchor="end" class="t txt${i}" font-size="20" opacity=".35">${i + 1}</text>
    </g>
  </g>`;
    })
    .join("");
  const body = `
<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>
${dots("FIVE TABS. ONE JOB EACH.", 40, 26, 2.5, 6, TXT)}
${cards}`;
  writeFileSync("assets/tabs.svg", svg(W, H, "DELT's five tabs: Today, New, Chances, Deadlines, Inbox", body, css));
}

// ---------- 4. stats strip ----------
{
  const W = 1200, H = 170;
  const stats = [
    { big: "118", label: "TESTS PASSING", fill: GOLD },
    { big: "14", label: "REPOS STUDIED", fill: LILAC },
    { big: "3000", label: "RANDOM MAILS · 0 CRASHES", fill: CREAM },
    { big: "0", label: "RUPEES TO RUN", fill: MIST },
  ];
  const cells = stats
    .map((s, i) => {
      const x = 30 + i * 288;
      const pitch = 6.4;
      return `
  <g transform="translate(${x} 22)">
    <rect x="6" y="6" width="268" height="122" rx="22" fill="${INK}"/>
    <g class="pop" style="animation-delay:${0.15 + i * 0.15}s">
      <rect width="268" height="122" rx="22" fill="${s.fill}" stroke="${INK}" stroke-width="4"/>
      ${dots(s.big, 22, 20, 2.8, pitch, ON, "count", 0.12)}
      <text x="22" y="104" class="m" font-size="12.5" fill="${ON}" letter-spacing=".5">${s.label}</text>
      ${i === 0 ? `<circle cx="246" cy="24" r="7" fill="${RED}" class="pulse"/>` : ""}
    </g>
  </g>`;
    })
    .join("");
  const extra = `
    .count { animation: count 4s ease-in-out infinite; }
    @keyframes count { 0%, 80%, 100% { opacity: 1; } 88% { opacity: .35; } }`;
  const body = `
<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>
${cells}`;
  writeFileSync("assets/stats.svg", svg(W, H, "118 tests passing, 14 repos studied, 3000 random mails with zero crashes, zero rupees to run", body, extra));
}

// ---------- 5. footer with a Nothing-style glyph light bar ----------
{
  const W = 1200, H = 150;
  const label = "MADE FOR VITIANS";
  const pitch = 5.6;
  const tw = textWidth(label, pitch);
  const body = `
<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>
${dots(label, (W - tw) / 2, 30, 2.5, pitch, GOLD)}
<circle cx="${(W - tw) / 2 + tw + 18}" cy="${30 + 6 * pitch}" r="6" fill="${RED}" class="pulse"/>
<g transform="translate(150 104)">
  <rect width="900" height="8" rx="4" fill="${TXT}" opacity=".1"/>
  <rect width="160" height="8" rx="4" fill="${GOLD}" class="scan"/>
  ${Array.from({ length: 31 }, (_, i) => `<circle cx="${i * 30}" cy="26" r="2.6" fill="${GOLD}" class="glyph" style="animation-delay:${(i * 0.08).toFixed(2)}s"/>`).join("")}
</g>`;
  const extra = `
    .scan { animation: scan 5s ease-in-out infinite; }
    @keyframes scan { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(740px); } }
    .glyph { opacity: .15; animation: glyph 2.5s ease-in-out infinite; }
    @keyframes glyph { 0%, 100% { opacity: .15; } 20% { opacity: 1; } 40% { opacity: .15; } }`;
  writeFileSync("assets/footer.svg", svg(W, H, "Made for VITians", body, extra));
}

console.log("assets written: download.svg sorting.svg tabs.svg stats.svg footer.svg");
