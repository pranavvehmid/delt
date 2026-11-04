// Draws the animated README pictures in assets/, in the same Swiss style as the app:
// paper and ink, one red, one typeface, importance shown by how dark the ink is.
// Pure SVG + CSS so GitHub plays them inside <img>; they follow GitHub's dark mode.
// Run: node tools/make_art.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const W = 1200;
const RED = "#c8102e";
const FONT = `"IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`;

const css = (extra = "") => `
  .bg { fill: #fafaf9; } .ink { fill: #1c1917; } .rule { stroke: #1c1917; } .red { fill: ${RED}; } .redline { stroke: ${RED}; }
  .inv { fill: #fafaf9; } .invs { stroke: #fafaf9; }
  text { font-family: ${FONT}; }
  .l { font-weight: 300; } .r { font-weight: 400; } .m { font-weight: 500; } .h { font-weight: 800; }
  .caps { font-weight: 500; letter-spacing: .12em; }
  .num { font-variant-numeric: tabular-nums; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #161412; } .ink { fill: #f5f4f2; } .rule { stroke: #f5f4f2; } .inv { fill: #161412; } .invs { stroke: #161412; }
    .red { fill: #ff4d5e; } .redline { stroke: #ff4d5e; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  ${extra}`;

const svg = (h, label, body, extra) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${label}">
<style>${css(extra)}</style>
<rect width="${W}" height="${h}" class="bg"/>
${body}
</svg>
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// importance is ink, exactly as in the app
const INK = { u: 1, p: 0.72, l: 0.48, n: 0.3 };
const PILE = { u: "URGENT", p: "PRIORITY", l: "LATER", n: "NOISE" };

/** One inbox row on the two-column grid: time | sender, subject. */
function row(x, y, { t, from, subj, k }, cls = "") {
  const a = INK[k];
  return `<g transform="translate(${x} ${y})"><g class="${cls}">
    ${k === "u" ? `<rect x="0" y="-6" width="20" height="3" class="red"/>` : ""}
    <text x="0" y="22" class="ink r num" font-size="15" fill-opacity="${(a * 0.6).toFixed(2)}">${t}</text>
    <text x="84" y="2" class="ink caps" font-size="12" fill-opacity="${(a * 0.6).toFixed(2)}">${esc(from.toUpperCase())}</text>
    <text x="84" y="30" class="ink ${k === "u" ? "m" : "r"}" font-size="22" fill-opacity="${a}">${esc(subj)}</text>
  </g></g>`;
}

mkdirSync("assets", { recursive: true });

// =====================================================================
// 1. BANNER: the logo, one line, and an inbox printing itself in ink
// =====================================================================
{
  const H = 520, cyc = 9;
  const mails = [
    { t: "9:41", from: "Controller of Examinations", subj: "CAT-1 schedule and seating", k: "u" },
    { t: "9:12", from: "ACM-VIT", subj: "HackVIT closes Friday", k: "p" },
    { t: "8:30", from: "Accounts", subj: "Hostel fee due 15 Nov", k: "u" },
    { t: "8:02", from: "SCOPE", subj: "Guest lecture on quantum computing", k: "l" },
    { t: "7:15", from: "VIT Store", subj: "50% off hoodies", k: "n" },
  ];
  let extra = `
  .dot { animation: dot 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes dot { 50% { transform: scale(1.25); } }`;
  const rows = mails
    .map((m, i) => {
      const a = i * 7;
      extra += `
  .r${i} { opacity: 0; animation: r${i} ${cyc}s cubic-bezier(.22,1,.36,1) infinite; }
  @keyframes r${i} { 0%, ${a}% { opacity: 0; transform: translateY(14px); } ${a + 8}%, 88% { opacity: 1; transform: none; } 96%, 100% { opacity: 0; } }`;
      return row(640, 150 + i * 72, m, `r${i}`);
    })
    .join("");
  const body = `
  <text x="72" y="104" class="ink caps" font-size="14" fill-opacity=".5">VIT VELLORE</text>
  <text x="62" y="268" class="ink h" font-size="190" letter-spacing="-9">DELT<tspan class="red" dx="4">.</tspan></text>
  <text x="72" y="340" class="ink l" font-size="34" letter-spacing="-.5">College mail, sorted by</text>
  <text x="72" y="384" class="ink l" font-size="34" letter-spacing="-.5">what needs you first.</text>
  <line x1="72" y1="440" x2="560" y2="440" class="rule" stroke-opacity=".12"/>
  <text x="72" y="470" class="ink caps" font-size="12" fill-opacity=".45">URGENT · PRIORITY · LATER · NOISE</text>
  <line x1="600" y1="96" x2="600" y2="470" class="rule" stroke-opacity=".1"/>
  <text x="640" y="104" class="ink caps" font-size="12" fill-opacity=".45">TODAY</text>
  ${rows}`;
  writeFileSync("assets/banner.svg", svg(H, "DELT: college mail, sorted by what needs you first", body, extra));
}

// =====================================================================
// 2. DOWNLOAD: a plain ink button with a moving arrow
// =====================================================================
{
  const H = 190, bw = 560, bh = 92, bx = (W - bw) / 2, by = 30;
  const extra = `
  .arrow { animation: arrow 1.6s ease-in-out infinite; } @keyframes arrow { 0%, 100% { transform: translateY(-5px); } 50% { transform: translateY(5px); } }
  .sweep { transform-origin: ${bx}px 0; animation: sweep 3.2s cubic-bezier(.22,1,.36,1) infinite; } @keyframes sweep { 0% { transform: scaleX(0); } 60%, 100% { transform: scaleX(1); } }`;
  const body = `
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="ink"/>
  <g transform="translate(${bx + 56} ${by + bh / 2})"><g class="arrow">
    <line x1="0" y1="-16" x2="0" y2="12" stroke-width="3" class="invs"/>
    <polyline points="-11,2 0,13 11,2" fill="none" stroke-width="3" class="invs"/>
  </g></g>
  <text x="${bx + 100}" y="${by + bh / 2 + 9}" class="inv r" font-size="26">Download for Android</text>
  <rect x="${bx}" y="${by + bh}" width="${bw}" height="4" class="red sweep"/>
  <text x="${W / 2}" y="${by + bh + 44}" text-anchor="middle" class="ink caps" font-size="12" fill-opacity=".5">APK · 400 KB · ANDROID 8 OR NEWER · FREE</text>`;
  writeFileSync("assets/download.svg", svg(H, "Download DELT for Android", body, extra));
}

// =====================================================================
// 3. SORTING: a reading line passes each mail; it settles to its ink and gets a label
// =====================================================================
{
  const H = 470, cyc = 10, step = 14;
  const mails = [
    { t: "Mon", from: "Academics", subj: "FFCS registration opens tomorrow", k: "u" },
    { t: "Mon", from: "Office of DSW", subj: "Holiday notice: Deepavali", k: "p" },
    { t: "Sun", from: "Dean SCOPE", subj: "Congratulations to Team Phoenix", k: "l" },
    { t: "Sun", from: "Coursera", subj: "Learn Python today, 40% off", k: "n" },
    { t: "Sat", from: "Prof. Rao", subj: "DA-2 due Friday 11:59 pm", k: "u" },
  ];
  let extra = `
  .scan { animation: scan ${cyc}s linear infinite; } @keyframes scan { 0% { transform: translateY(0); opacity: 1; } ${step * 5}% { transform: translateY(${5 * 62}px); opacity: 1; } ${step * 5 + 4}%, 100% { transform: translateY(${5 * 62}px); opacity: 0; } }`;
  const rows = mails
    .map((m, i) => {
      const hit = i * step + 3;
      const a = INK[m.k];
      extra += `
  .s${i} { animation: s${i} ${cyc}s ease-out infinite; } @keyframes s${i} { 0%, ${hit}% { opacity: .18; } ${hit + 4}%, 94% { opacity: 1; } 100% { opacity: .18; } }
  .lab${i} { opacity: 0; animation: lab${i} ${cyc}s ease-out infinite; } @keyframes lab${i} { 0%, ${hit}% { opacity: 0; transform: translateX(-8px); } ${hit + 5}%, 94% { opacity: ${Math.max(a, 0.45)}; transform: none; } 100% { opacity: 0; } }`;
      const y = 150 + i * 62;
      return `${row(72, y, m, `s${i}`)}
  <text x="1128" y="${y + 30}" text-anchor="end" class="${m.k === "u" ? "red" : "ink"} caps lab${i}" font-size="13">${PILE[m.k]}</text>`;
    })
    .join("");
  const body = `
  <text x="72" y="64" class="ink caps" font-size="13" fill-opacity=".45">HOW DELT SORTS</text>
  <text x="72" y="108" class="ink l" font-size="34" letter-spacing="-.5">The more a mail matters, the darker it prints.</text>
  <g class="scan"><line x1="72" y1="140" x2="1128" y2="140" class="redline" stroke-width="1.5"/></g>
  ${rows}`;
  writeFileSync("assets/sorting.svg", svg(H, "Each mail is read and printed darker the more it matters: urgent, priority, later, noise", body, extra));
}

// =====================================================================
// 4. SCREENS: the masthead switches between Inbox and Deadlines
// =====================================================================
{
  const H = 440, cyc = 8;
  const extra = `
  .ib { animation: ib ${cyc}s cubic-bezier(.22,1,.36,1) infinite; } @keyframes ib { 0%, 44% { fill-opacity: 1; } 52%, 94% { fill-opacity: .2; } 100% { fill-opacity: 1; } }
  .dl { animation: dl ${cyc}s cubic-bezier(.22,1,.36,1) infinite; } @keyframes dl { 0%, 44% { fill-opacity: .2; } 52%, 94% { fill-opacity: 1; } 100% { fill-opacity: .2; } }
  .pi { animation: pi ${cyc}s cubic-bezier(.22,1,.36,1) infinite; } @keyframes pi { 0%, 44% { opacity: 1; transform: none; } 50%, 96% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; } }
  .pd { opacity: 0; animation: pd ${cyc}s cubic-bezier(.22,1,.36,1) infinite; } @keyframes pd { 0%, 48% { opacity: 0; transform: translateY(10px); } 56%, 94% { opacity: 1; transform: none; } 100% { opacity: 0; } }`;
  const inbox = [
    { t: "9:41", from: "Controller of Examinations", subj: "CAT-1 schedule and seating", k: "u" },
    { t: "9:12", from: "ACM-VIT", subj: "HackVIT closes Friday", k: "p" },
    { t: "8:02", from: "SCOPE", subj: "Guest lecture on quantum computing", k: "l" },
  ]
    .map((m, i) => row(72, 196 + i * 72, m))
    .join("");
  const dl = [
    ["5", "NOV", "DA-2 for BCSE101", "TOMORROW 11:59 PM", true],
    ["6", "NOV", "CAT-1 exam", "IN 2 DAYS", false],
    ["9", "NOV", "FFCS registration closes", "IN 5 DAYS", false],
  ]
    .map(
      ([d, mo, title, when, soon], i) => `<g transform="translate(72 ${206 + i * 72})">
      <text x="0" y="22" class="${soon ? "red" : "ink"} l num" font-size="44" letter-spacing="-2">${d}</text>
      <text x="2" y="42" class="ink caps" font-size="11" fill-opacity=".45">${mo}</text>
      <text x="84" y="10" class="ink r" font-size="22">${esc(title)}</text>
      <text x="84" y="36" class="${soon ? "red" : "ink"} caps" font-size="12" fill-opacity="${soon ? 1 : 0.55}">${when}</text>
    </g>`,
    )
    .join("");
  const body = `
  <text x="72" y="64" class="ink caps" font-size="13" fill-opacity=".45">TWO SCREENS</text>
  <text x="66" y="140" class="ink l ib" font-size="76" letter-spacing="-3">Inbox</text>
  <text x="300" y="140" class="ink l dl" font-size="76" letter-spacing="-3">Deadlines</text>
  <g class="pi">${inbox}</g>
  <g class="pd">${dl}</g>`;
  writeFileSync("assets/tabs.svg", svg(H, "Two screens: Inbox with every mail, and Deadlines found in mail", body, extra));
}

// =====================================================================
// 5. STATS: four big light numbers
// =====================================================================
{
  const H = 190;
  const stats = [
    ["151", "TESTS PASSING"],
    ["14", "MAIL APPS STUDIED"],
    ["3000", "RANDOM MAILS, NO CRASH"],
    ["0", "RUPEES TO RUN"],
  ];
  let extra = "";
  const cells = stats
    .map(([n, l], i) => {
      const x = 72 + i * 270;
      extra += `
  .c${i} { opacity: 0; animation: c${i} 7s cubic-bezier(.22,1,.36,1) infinite; } @keyframes c${i} { 0%, ${i * 6}% { opacity: 0; transform: translateY(12px); } ${i * 6 + 10}%, 90% { opacity: 1; transform: none; } 100% { opacity: 0; } }`;
      return `<g class="c${i}">
      <rect x="${x}" y="40" width="${i === 0 ? 40 : 230}" height="2" class="${i === 0 ? "red" : "ink"}" fill-opacity="${i === 0 ? 1 : 0.15}"/>
      <text x="${x - 4}" y="122" class="ink l num" font-size="72" letter-spacing="-3">${n}</text>
      <text x="${x}" y="154" class="ink caps" font-size="12" fill-opacity=".5">${l}</text>
    </g>`;
    })
    .join("");
  writeFileSync("assets/stats.svg", svg(H, "151 tests passing · 14 mail apps studied · 3000 random mails, no crash · 0 rupees to run", cells, extra));
}

// =====================================================================
// 6. FOOTER: the mark, small
// =====================================================================
{
  const H = 150;
  const extra = `.dot { animation: dot 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; } @keyframes dot { 50% { transform: scale(1.3); } }`;
  const body = `
  <line x1="72" y1="30" x2="1128" y2="30" class="rule" stroke-opacity=".12"/>
  <text x="70" y="96" class="ink h" font-size="40" letter-spacing="-2">DELT<tspan class="red" dx="1">.</tspan></text>
  <text x="1128" y="80" text-anchor="end" class="ink r" font-size="17" fill-opacity=".75">For VIT students. Free and open source.</text>
  <text x="1128" y="104" text-anchor="end" class="ink caps" font-size="11" fill-opacity=".45">READS AND LABELS MAIL · NEVER DELETES</text>`;
  writeFileSync("assets/footer.svg", svg(H, "DELT, for VIT students. Free and open source.", body, extra));
}

console.log("assets: banner download sorting tabs stats footer");
