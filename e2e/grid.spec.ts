// #73, #74: Grid reads like F1's TV graphics: upright type, flat panels, a real timing tower.
import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("delt-prefs", JSON.stringify({ look: "grid", mode: "dark", accent: "auto", size: "normal", density: "comfortable" })));
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page.locator("li.row .pos").first()).toBeVisible();
});

test("nothing is italic, slanted or textured (#73)", async ({ page }) => {
  const found = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of [document.body, ...document.querySelectorAll("body *")]) {
      for (const pseudo of [null, "::before", "::after"]) {
        const s = getComputedStyle(el, pseudo);
        const what = `${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ""}`;
        if (!pseudo && s.fontStyle === "italic" && el.textContent?.trim()) bad.push(`italic: ${what}`);
        if (s.transform.startsWith("matrix(") && s.transform.split(",")[2]?.trim() !== "0") bad.push(`slanted: ${what} ${s.transform}`);
        if (/repeating-|conic-gradient/.test(s.backgroundImage)) bad.push(`texture: ${what}`);
      }
    }
    return bad;
  });
  expect(found).toEqual([]);
});

test("the inbox is a timing tower: P1 leads, rows sit flush, each has a pile-colour bar (#74)", async ({ page }) => {
  const rows = page.locator(".day.needs li.row");
  await expect(rows.first().locator(".gap")).toHaveText("LEADER");
  await expect(rows.first().locator(".pos")).toHaveText("1");
  await expect(rows.nth(1).locator(".gap")).toHaveText(/^\+\d+[MHD]/);
  // only P1 says LEADER
  await expect(page.locator(".gap", { hasText: "LEADER" })).toHaveCount(1);
  // flush rows: each starts where the one above ends
  const gaps = await page.locator(".day .rows").evaluateAll((lists) =>
    lists.flatMap((ul) => [...ul.children].slice(1).map((li) => li.getBoundingClientRect().top - li.previousElementSibling!.getBoundingClientRect().bottom)),
  );
  expect(gaps.length).toBeGreaterThan(0);
  for (const g of gaps) expect(Math.abs(g)).toBeLessThanOrEqual(0.5);
  // the team-colour stripe is the pile's flag colour: red for Urgent
  const stripe = await rows.first().locator(".row-text").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(stripe).toContain("rgb(255, 59, 48)");
});

test("panels use F1's rounded top-right corner and nothing else is rounded (#73)", async ({ page }) => {
  const r = await page.locator(".day").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
  });
  expect(r).toEqual(["0px", "10px", "0px", "0px"]);
});

test.describe("motion (#75)", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });
  test("rows enter like F1's grid graphics: sweep, wipe, rise, 35ms apart, once", async ({ page }) => {
    // beforeEach already loaded the page; load again with motion on and catch the entrance
    await page.reload();
    await expect(page.locator("li.row .pos").first()).toBeVisible();
    const anims = await page.evaluate(() =>
      document.getAnimations().map((a) => {
        const t = a.effect!.getComputedTiming(), el = (a.effect as KeyframeEffect).target as Element;
        return { name: (a as CSSAnimation).animationName, delay: Math.round(t.delay ?? 0), duration: Math.round(Number(t.duration)), pos: Number(el.closest("li.row")?.getAttribute("data-pos") ?? 0) };
      }),
    );
    const names = new Set(anims.map((a) => a.name));
    for (const n of ["f1-sweep", "f1-wipe", "f1-rise"]) expect(names, [...names].join()).toContain(n);
    for (const a of anims.filter((a) => a.name.startsWith("f1-"))) expect(a.duration).toBeLessThanOrEqual(420);
    // the sweep for P2 starts 35ms after P1's
    const sweep = (p: number) => anims.find((a) => a.name === "f1-sweep" && a.pos === p)!.delay;
    expect(sweep(2) - sweep(1)).toBe(35);
    // once settled, changing the filter draws rows straight away
    await expect(page.locator("html")).toHaveClass(/settled/, { timeout: 5000 });
    await page.getByRole("navigation", { name: "Filter by pile" }).getByRole("button", { name: /^Later/ }).click();
    await expect(page.locator("li.row").first()).toBeVisible();
    const after = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName).filter((n) => n?.startsWith("f1-")));
    expect(after.filter((n) => n !== "f1-bar")).toEqual([]);
  });
});

test("with reduce motion, Grid doesn't animate", async ({ page }) => {
  await page.reload();
  const long = await page.evaluate(() => document.getAnimations().filter((a) => Number(a.effect!.getComputedTiming().duration) > 1).length);
  expect(long).toBe(0);
});
