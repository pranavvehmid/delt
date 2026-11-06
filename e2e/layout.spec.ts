// #67–#70: the layout is measured, not eyeballed. Edges, baselines and sizes that should match do.
import { expect, test, type Page } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

const LOOKS = ["minimal", "glyph", "grid"] as const;

async function open(page: Page, look: (typeof LOOKS)[number]) {
  await page.addInitScript((l) => {
    localStorage.setItem("delt-prefs", JSON.stringify({ look: l, mode: l === "grid" ? "dark" : "light", accent: "auto", size: "normal", density: "comfortable" }));
    localStorage.setItem("delt-welcomed", "1");
  }, look);
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page.locator("li.row").first()).toBeVisible();
  // rows draw only the parts their look shows (#61); wait until they're the right look's rows
  const part = { minimal: ".when", glyph: ".avatar", grid: ".pos" }[look];
  await expect(page.locator(`li.row ${part}`).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // rows drawn a moment later (#60) slide in; measure where they end up
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => null))),
  );
}

const box = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);
const near = (a: number, b: number, what: string, tol = 1) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);

for (const look of LOOKS) {
  test(`${look}: header, search and rows share the same left and right edges (#67)`, async ({ page }) => {
    await open(page, look);
    const [logo, search, avatar, row] = await Promise.all([box(page, ".logo"), box(page, ".searchbar"), box(page, ".avatar.me"), box(page, "li.row")]);
    near(logo.left, search.left, "logo / search left");
    near(row.left, search.left, "row / search left");
    near(avatar.right, search.right, "avatar / search right");
    // header controls are one height
    const sync = await box(page, ".sync");
    near(sync.height, avatar.height, "status chip / avatar height");
    near(sync.top + sync.height / 2, avatar.top + avatar.height / 2, "status chip / avatar centre");
  });

  test(`${look}: in a row, the sender and the subject start on one edge, read or unread (#67)`, async ({ page }) => {
    await open(page, look);
    const edges = await page.locator("li.row").evaluateAll((rows) =>
      rows.map((r) => {
        // Grid starts the line with the sender's short code (like a driver's three letters)
        const from = r.querySelector(".code") ?? r.querySelector(".from")!, subj = r.querySelector(".subj")!;
        // where the words start: the first text node, not a marker drawn before it
        const range = document.createRange();
        const textOf = (el: Element) => [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent!.trim()) ?? el;
        range.selectNodeContents(textOf(from));
        const f = range.getBoundingClientRect().left;
        range.selectNodeContents(textOf(subj));
        return { f, s: range.getBoundingClientRect().left, unread: r.classList.contains("unread"), id: r.getAttribute("data-mail") + " pos=" + !!r.querySelector(".pos") + " " + r.className };
      }),
    );
    for (const e of edges) near(e.s, e.f, `subject / sender (${e.unread ? "unread" : "read"})`, 1.5);
    const subjects = edges.map((e) => e.s);
    near(Math.min(...subjects), Math.max(...subjects), "every subject's left edge " + JSON.stringify(edges.map((e) => [e.id, e.s])), 1.5);
  });
}

for (const look of ["minimal", "grid"] as const) {
  test(`${look}: the time lines up with the sender, not between sender and subject (#67)`, async ({ page }) => {
    await open(page, look);
    const pairs = await page.locator("li.row").evaluateAll((rows) =>
      rows.map((r) => ({ when: r.querySelector(".when")?.getBoundingClientRect().top ?? null, from: r.querySelector(".from")?.getBoundingClientRect().top ?? null })),
    );
    for (const p of pairs) if (p.when !== null && p.from !== null) near(p.when, p.from, "time / sender top", 2);
  });
}

test("Deadlines: Calendar and Done put their icons and labels on the same lines (#67)", async ({ page }) => {
  await open(page, "minimal");
  await page.locator("button:visible", { hasText: /^Deadlines/ }).first().click();
  const [cal, done] = await page.locator(".iconbtn.labelled").evaluateAll((els) =>
    els.slice(0, 2).map((b) => ({ svg: b.querySelector("svg")!.getBoundingClientRect().top, label: b.querySelector("small")!.getBoundingClientRect().top })),
  );
  near(cal.svg, done.svg, "icon tops");
  near(cal.label, done.label, "label tops");
});

test("Glyph: the two section tabs are the same width; on a wide screen they sit at the top (#67)", async ({ page }, info) => {
  await open(page, "glyph");
  if (info.project.name === "desktop") {
    await expect(page.locator(".tabbar")).toBeHidden();
    await expect(page.locator(".mast")).toBeVisible();
    const mast = await box(page, ".mast button");
    expect(mast.top).toBeLessThan(140);
    return;
  }
  const widths = await page.locator(".tabbar button").evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().width));
  near(widths[0], widths[1], "tab widths");
});

test("the open mail's Back arrow lines up with the mail text (#67)", async ({ page }) => {
  await open(page, "minimal");
  await page.locator('li.row[data-mail="cat1"] .row-main').click();
  await expect(page.locator("#mv-title")).toBeVisible();
  // the chevron is drawn from x=8 of its 24-unit box
  const arrow = await page.locator(".mv-back svg").evaluate((s) => { const b = s.getBoundingClientRect(); return b.left + (b.width * 8) / 24; });
  const title = await box(page, "#mv-title");
  near(arrow, title.left, "Back arrow / mail title", 2);
});

test("the sign-in wordmark starts on the text's left edge (#67)", async ({ page }) => {
  await page.goto("/");
  const ink = await page.locator(".signin .logo").evaluate((l) => {
    const cs = getComputedStyle(l);
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return l.getBoundingClientRect().left - c.measureText("D").actualBoundingBoxLeft;
  });
  const text = await page.locator(".signin h1").evaluate((h) => {
    const cs = getComputedStyle(h);
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return h.getBoundingClientRect().left - c.measureText(h.textContent!.trim()[0]).actualBoundingBoxLeft;
  });
  near(ink, text, "wordmark ink / heading ink", 1.5);
});

test("Minimal: the unread square is centred on the subject's first line, left of its edge (#67)", async ({ page }) => {
  await open(page, "minimal");
  const m = await page.locator('li.row.unread[data-mail="hack"] .row-text').evaluate((el) => {
    const cs = getComputedStyle(el, "::before");
    const t = el.getBoundingClientRect();
    const subj = el.querySelector(".subj")!;
    const lh = parseFloat(getComputedStyle(subj).lineHeight);
    const s = subj.getBoundingClientRect();
    return { top: t.top + parseFloat(cs.top), size: parseFloat(cs.height), left: t.left + parseFloat(cs.left), lineMid: s.top + lh / 2, subjLeft: s.left, rowLeft: el.closest("li")!.getBoundingClientRect().left };
  });
  near(m.top + m.size / 2, m.lineMid, "square centre / first line centre", 1.5);
  expect(m.left + m.size).toBeLessThan(m.subjLeft);
  expect(m.left).toBeGreaterThan(m.rowLeft);
});

// #68: spacing comes from one scale (4px steps; 1–2px only as hairline nudges)
for (const look of LOOKS) {
  test(`${look}: every padding, margin and gap on the inbox, Settings and Appearance is on the 4px scale (#68)`, async ({ page }) => {
    await open(page, look);
    const off = async (where: string) =>
      page.evaluate((where) => {
        const props = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom", "rowGap", "columnGap"] as const;
        const bad: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          const cs = getComputedStyle(el);
          for (const p of props) {
            const v = cs[p];
            if (!v.endsWith("px")) continue;
            const n = Math.abs(parseFloat(v));
            if (![0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96].includes(Math.round(n * 100) / 100)) bad.push(`${where} ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${p}=${v}`);
          }
        }
        return bad;
      }, where);
    const bad = [...(await off("inbox"))];
    await page.getByRole("button", { name: "Account" }).click();
    await page.locator("#acct-menu .menu-item", { hasText: /^Settings$/ }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    bad.push(...(await off("settings")));
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Appearance/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Appearance" })).toBeVisible();
    bad.push(...(await off("appearance")));
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("on a wide screen the list keeps its column and an empty pane waits beside it (#68)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "wide screens only");
  await open(page, "minimal");
  const pane = page.locator(".mv-empty");
  await expect(pane).toBeVisible();
  await expect(pane).toContainText("No mail open");
  const list = await box(page, ".searchbar");
  expect(list.right).toBeLessThanOrEqual(460);
  await page.locator('li.row[data-mail="cat1"] .row-main').click();
  await expect(pane).toHaveCount(0);
  await expect(page.locator(".mailview.pane")).toBeVisible();
});
