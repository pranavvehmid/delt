// Draws assets/banner.svg: DELT's animated README cover.
// Run: node tools/make_banner.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const W = 1200, H = 520;
const INK = "#0b0716", ON = "#1b1238", BG = "#17112b", GOLD = "#f5c842", GOLD2 = "#ffe6a1", LAV = "#d9ccff", LILAC = "#b9a2ff", CREAM = "#fff3d1", RED = "#d71921";

// 5x7 dot fonts for D E L T
const FONT = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function word(text, x0, y0, r, pitch) {
  let out = "";
  [...text].forEach((ch, i) => {
    const g = FONT[ch];
    let dots = "";
    g.forEach((row, ry) =>
      [...row].forEach((v, cx) => {
        if (v === "1") dots += `<circle cx="${(cx * pitch).toFixed(1)}" cy="${(ry * pitch).toFixed(1)}" r="${r}"/>`;
      }),
    );
    const x = x0 + i * pitch * 6;
    out += `<g transform="translate(${x} ${y0})"><g class="ltr" style="animation-delay:${0.1 + i * 0.09}s" fill="${ON}">${dots}</g></g>`;
  });
  return out;
}

const SPARK = "M29 0c1.6 15 6.4 22.4 29 29-22.6 7-27.4 14.4-29 29-1.6-14.6-6.4-22-29-29C22.6 22.4 27.4 15 29 0z";

function chip(x, y, num, label, delay, bob) {
  const w = 34 + label.length * 9.5 + String(num).length * 14;
  return `<g transform="translate(${x} ${y})"><g class="${bob}"><g class="pop" style="animation-delay:${delay}s">
    <rect x="3" y="3" width="${w}" height="40" rx="20" fill="${ON}"/>
    <rect width="${w}" height="40" rx="20" fill="#fff" stroke="${ON}" stroke-width="2.5"/>
    <text x="16" y="27" class="t" font-size="20" fill="${ON}">${num}</text>
    <text x="${24 + String(num).length * 13}" y="26" class="b" font-size="16" fill="${ON}">${label}</text>
  </g></g></g>`;
}

// phone mock-up with the NEW deck and the 5-tab bar
function phone(x, y) {
  const tabs = ["Today", "New", "Board", "Due", "Inbox"];
  const tabBar = tabs
    .map((t, i) => {
      const tx = 22 + i * 46;
      const on = i === 1;
      return `<g transform="translate(${tx} 0)">${on ? `<rect x="-17" y="-13" width="34" height="20" rx="10" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>` : ""}<circle cx="0" cy="-3" r="4" fill="${on ? ON : "#b3a8cf"}"/><text x="0" y="20" text-anchor="middle" class="b" font-size="9" fill="${on ? "#f7f1e3" : "#b3a8cf"}">${t}</text></g>`;
    })
    .join("");
  const card = (fill, title, line, cls) => `<g class="${cls}">
      <rect x="4" y="4" width="196" height="200" rx="18" fill="${INK}"/>
      <rect width="196" height="200" rx="18" fill="${fill}" stroke="${INK}" stroke-width="3"/>
      <rect x="14" y="14" width="74" height="16" rx="4" fill="${ON}"/><text x="51" y="26" text-anchor="middle" class="m" font-size="9" fill="#fff">${line}</text>
      <text x="14" y="58" class="b" font-size="17" fill="${ON}">${title[0]}</text>
      <text x="14" y="80" class="b" font-size="17" fill="${ON}">${title[1]}</text>
      <text x="14" y="102" class="b" font-size="17" fill="${ON}">${title[2]}</text>
      <rect x="14" y="128" width="150" height="8" rx="4" fill="${ON}" opacity=".18"/>
      <rect x="14" y="144" width="120" height="8" rx="4" fill="${ON}" opacity=".18"/>
      <text x="14" y="184" class="m" font-size="10" fill="${ON}" opacity=".7">Director, SW</text>
    </g>`;
  return `<g transform="translate(${x} ${y})"><g class="float">
    <rect x="8" y="8" width="260" height="430" rx="38" fill="${INK}"/>
    <rect width="260" height="430" rx="38" fill="${BG}" stroke="${INK}" stroke-width="4"/>
    <rect x="96" y="14" width="68" height="8" rx="4" fill="${INK}"/>
    <text x="22" y="56" class="t" font-size="22" fill="#f7f1e3">NEW</text>
    <text x="90" y="55" class="m" font-size="10" fill="#b3a8cf">11 unread · swipe</text>
    <g transform="translate(30 76)">
      <g transform="translate(6 14) rotate(3 98 100)">${card(LAV, ["", "", ""], "EVENT", "")}</g>
      ${card(LILAC, ["HackVIT 2026", "registrations", "close Friday"], "HACKATHON", "swipe")}
      <g class="stamp"><rect x="18" y="20" width="84" height="30" rx="8" fill="#fff" stroke="#1b8a4a" stroke-width="3" transform="rotate(-12 60 35)"/><text x="60" y="41" text-anchor="middle" class="t" font-size="15" fill="#1b8a4a" transform="rotate(-12 60 35)">GOT IT</text></g>
    </g>
    <g transform="translate(30 312)">
      <rect x="0" y="0" width="94" height="34" rx="12" fill="#261c45" stroke="${INK}" stroke-width="2.5"/><text x="47" y="22" text-anchor="middle" class="b" font-size="12" fill="#f7f1e3">✕ Not for me</text>
      <rect x="110" y="0" width="90" height="34" rx="12" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/><text x="155" y="22" text-anchor="middle" class="b" font-size="12" fill="${ON}">✓ Got it</text>
    </g>
    <g transform="translate(15 392)">
      <rect x="0" y="-22" width="230" height="44" rx="22" fill="#261c45" stroke="${INK}" stroke-width="2.5"/>
      ${tabBar}
    </g>
  </g></g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="DELT: your VIT inbox, sorted. Animated cover.">
<defs>
  <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#f7d26e" opacity=".14"/></pattern>
  <pattern id="ink" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="${ON}" opacity=".2"/></pattern>
  <style>
    .t { font-family: "Arial Black", "Segoe UI Black", Impact, sans-serif; font-weight: 900; }
    .b { font-family: "Segoe UI", Arial, sans-serif; font-weight: 700; }
    .m { font-family: Consolas, "Courier New", monospace; font-weight: 700; }
    .ltr { animation: drop .65s cubic-bezier(.3,1.5,.6,1) both; }
    @keyframes drop { 0% { opacity: 0; transform: translateY(-46px); } 70% { opacity: 1; transform: translateY(5px); } 100% { opacity: 1; transform: none; } }
    .pop { transform-box: fill-box; transform-origin: center; animation: pop .5s cubic-bezier(.3,1.4,.6,1) both; }
    @keyframes pop { 0% { opacity: 0; transform: scale(.4); } 65% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
    .float { animation: float 4.5s ease-in-out infinite; }
    .bob1 { animation: float 4s ease-in-out infinite; } .bob2 { animation: float 5s ease-in-out infinite reverse; } .bob3 { animation: float 3.6s ease-in-out .6s infinite; }
    @keyframes float { 50% { transform: translateY(-7px); } }
    .spin { transform-box: fill-box; transform-origin: center; animation: spin 9s linear infinite; }
    .spin2 { transform-box: fill-box; transform-origin: center; animation: spin 6s linear infinite reverse; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 2.2s ease-in-out infinite; }
    @keyframes pulse { 50% { transform: scale(1.35); } }
    .drift { animation: drift 24s linear infinite; }
    @keyframes drift { to { transform: translate(22px, 44px); } }
    .swipe { transform-box: view-box; animation: swipe 5s cubic-bezier(.5,0,.3,1) infinite; }
    @keyframes swipe { 0%, 40% { transform: translate(0,0) rotate(0); opacity: 1; } 62% { transform: translate(300px, 10px) rotate(16deg); opacity: 0; } 63%, 78% { transform: translate(0, 20px) scale(.96); opacity: 0; } 95%, 100% { transform: translate(0,0); opacity: 1; } }
    .stamp { opacity: 0; animation: stamp 5s ease infinite; }
    @keyframes stamp { 0%, 22% { opacity: 0; } 32%, 52% { opacity: 1; } 60%, 100% { opacity: 0; } }
    .blink { animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: .15; } }
    .scan { animation: scan 6s ease-in-out infinite; }
    @keyframes scan { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(280px); } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  </style>
</defs>

<rect width="${W}" height="${H}" fill="${BG}"/>
<g class="drift"><rect x="-44" y="-44" width="${W + 88}" height="${H + 88}" fill="url(#grid)"/></g>

<!-- gold hero block -->
<rect x="54" y="54" width="720" height="412" rx="30" fill="${INK}"/>
<rect x="46" y="46" width="720" height="412" rx="30" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>
<text x="84" y="96" class="m" font-size="15" fill="${ON}" letter-spacing="1.5">VIT VELLORE · YOUR INBOX, SORTED</text>
${word("DELT", 84, 128, 9.5, 24)}
<circle cx="640" cy="272" r="13" fill="${RED}" class="pulse"/>
<text x="84" y="334" class="m" font-size="17" fill="${ON}" letter-spacing="1">DON'T JUST READ MAIL. DELT WITH IT.</text>
${chip(84, 364, 11, "unread", 0.8, "bob1")}
${chip(250, 364, 3, "deadlines", 0.95, "bob2")}
${chip(436, 364, 4, "chances", 1.1, "bob3")}
<g transform="translate(676 74)"><path d="${SPARK}" fill="${ON}" class="spin"/></g>
<g transform="translate(626 150) scale(.45)"><path d="${SPARK}" fill="${ON}" class="spin2"/></g>

<!-- scanning glyph strip under the hero, like a Nothing light bar -->
<g transform="translate(84 432)">
  <rect width="600" height="6" rx="3" fill="${ON}" opacity=".18"/>
  <rect width="120" height="6" rx="3" fill="${ON}" class="scan"/>
</g>

${phone(870, 40)}

<g transform="translate(1110 470)"><path d="${SPARK}" fill="${GOLD}" class="spin" transform="scale(.5)"/></g>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/banner.svg", svg);
console.log("assets/banner.svg", svg.length, "bytes");
