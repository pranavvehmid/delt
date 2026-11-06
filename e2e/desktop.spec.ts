// #76: on a laptop DELT is a desktop mail app, not a stretched phone.
import { expect, test, type Page } from "@playwright/test";
import { mockApi, smallInbox, bigInbox } from "./mock";

const LOOKS = ["minimal", "glyph", "grid"] as const;
const SIZES = [{ width: 1366, height: 657 }, { width: 1536, height: 730 }];

async function open(page: Page, look: string, size: { width: number; height: number }, mails = bigInbox(40)) {
  await page.setViewportSize(size);
  await page.addInitScript((l) => localStorage.setItem("delt-prefs", JSON.stringify({ look: l, mode: l === "grid" ? "dark" : "light", accent: "auto", size: "normal", density: "comfortable" })), look);
  await mockApi(page, mails);
  await page.goto("/e2e");
  await expect(page.locator("li.row").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const box = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);

for (const look of LOOKS) {
  for (const size of SIZES) {
    test(`${look} ${size.width}×${size.height}: one top bar across the window, list and pane under it`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop");
      await open(page, look, size);
      const bar = await box(page, ".appbar");
      expect(bar.left).toBe(0);
      expect(bar.width).toBe(size.width);
      // sections, search and the account all live in the bar; the account at the window's right edge
      for (const sel of [".appbar .mast", ".appbar .searchbar", ".appbar .avatar.me"]) {
        const b = await box(page, sel);
        expect(b.top, sel).toBeGreaterThanOrEqual(bar.top);
        expect(b.bottom, sel).toBeLessThanOrEqual(bar.bottom + 0.5);
      }
      expect(size.width - (await box(page, ".appbar .avatar.me")).right).toBeLessThanOrEqual(24.5);
      await expect(page.locator("main .searchbar")).toHaveCount(0);
      // the list column scales with the window; the empty pane starts where the list ends, under the bar
      const list = await box(page, ".shell");
      expect(list.width).toBeCloseTo(Math.min(520, Math.max(380, size.width * 0.32)), 0);
      const pane = await box(page, ".mv-empty");
      expect(pane.left).toBeCloseTo(list.right, 0);
      expect(pane.top).toBeCloseTo(bar.bottom, 0);
    });

    test(`${look} ${size.width}×${size.height}: at least 5 mails show without scrolling`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop");
      await open(page, look, size);
      const tops = await page.locator("li.row").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      const visible = tops.filter((t) => t + 40 < size.height).length;
      expect(visible, `rows start at ${tops.slice(0, 7).map(Math.round)}`).toBeGreaterThanOrEqual(5);
    });
  }

  test(`${look}: scrolling the list leaves the top bar and the open mail where they are`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await open(page, look, SIZES[0]);
    await page.locator("li.row .row-main").first().click();
    await expect(page.locator(".mailview.pane")).toBeVisible();
    const [bar, pane] = [await box(page, ".appbar"), await box(page, ".mailview.pane")];
    await page.mouse.move(150, 400);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
    expect((await box(page, ".appbar")).top).toBe(bar.top);
    expect((await box(page, ".mailview.pane")).top).toBe(pane.top);
  });
}

test("deadline titles wrap instead of being cut off", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await open(page, "glyph", SIZES[0], smallInbox());
  await page.locator(".appbar .mast button", { hasText: "Deadlines" }).click();
  const subj = page.locator(".due-row .subj").first();
  await expect(subj).toBeVisible();
  expect(await subj.evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis" || e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  expect(await subj.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("normal");
});

test("typing in the bar's search from Deadlines goes to the inbox results", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await open(page, "minimal", SIZES[0], smallInbox());
  await page.locator(".appbar .mast button", { hasText: "Deadlines" }).click();
  await page.locator(".appbar .searchbar input").fill("hostel");
  await expect(page.locator(".appbar .mast button.on")).toHaveText(/Inbox/);
  await expect(page.locator("li.row")).toHaveCount(1);
});

for (const look of LOOKS) {
  test(`${look}: A04: every pile filter is fully inside the laptop list column`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await open(page, look, SIZES[0]);
    const col = await box(page, ".shell");
    const chips = await page.locator(".chips .fchip").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    expect(chips.length).toBe(5);
    for (const c of chips) expect(c.right).toBeLessThanOrEqual(col.right - 16);
  });
}
