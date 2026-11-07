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
      // Glyph's outlined cards are ~100px tall by design: four full cards fit a 657px window
      expect(visible, `rows start at ${tops.slice(0, 7).map(Math.round)}`).toBeGreaterThanOrEqual(look === "glyph" && size.height < 700 ? 4 : 5);
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

for (const look of LOOKS) {
  for (const size of [SIZES[0], { width: 412, height: 915 }]) {
    test(`${look} ${size.width}px: deadline titles are shown in full, not cut off (#192)`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop");
      await open(page, look, size, smallInbox());
      await page.locator("button:visible", { hasText: /^Deadlines/ }).first().click();
      const subj = page.locator(".due-row .subj").first();
      await expect(subj).toBeVisible();
      const fit = await subj.evaluate((e) => ({ clipped: e.scrollHeight > e.clientHeight + 1, width: e.getBoundingClientRect().width }));
      expect(fit.clipped).toBe(false);
      expect(fit.width).toBeGreaterThan(200);
    });
  }
}

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

for (const look of LOOKS) {
  test(`${look}: A05: with no mail open the laptop pane shows today at a glance, and each item opens its mail`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await open(page, look, SIZES[0], smallInbox());
    const ov = page.locator(".overview");
    await expect(ov.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(ov.locator(".ov-stats div", { hasText: "Unread" }).locator("dd")).toHaveText("4");
    await expect(ov.locator(".ov-stats div", { hasText: "Needs you" }).locator("dd")).toHaveText("2");
    await expect(ov.locator(".ov-stats div", { hasText: "Due this week" }).locator("dd")).toHaveText("1");
    await ov.getByRole("button", { name: /Hostel fee payment/ }).first().click();
    await expect(page.locator(".mailview.pane #mv-title")).toHaveText(/Hostel fee payment/);
    await expect(ov).toHaveCount(0);
    // A18: the mail's text starts on the pane's 40px gutter
    const [pane, subj] = [await box(page, ".mailview.pane"), await box(page, ".mv-subj")];
    expect(Math.round(subj.left - pane.left)).toBe(40 + 1); // +1: the pane's left hairline
  });
}

test("A18: the open mail's action buttons end on the mail content's right edge", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await open(page, "minimal", SIZES[0], smallInbox());
  await page.locator('li.row[data-mail="cat1"] .row-main').click();
  await expect(page.locator(".mv-frame")).toBeVisible();
  const [gmail, sum] = [await box(page, ".mv-gmail"), await box(page, ".mv-sum")];
  expect(Math.abs(gmail.right - sum.right)).toBeLessThanOrEqual(1);
});

for (const look of LOOKS) {
  test(`${look}: in a narrow deadline list the actions line up under the title (#192)`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await open(page, look, SIZES[0], smallInbox());
    await page.locator("button:visible", { hasText: /^Deadlines/ }).first().click();
    const row = page.locator(".due-row").first();
    await expect(row).toBeVisible();
    const [subj, cal] = [await row.locator(".subj").boundingBox(), await row.locator(".iconbtn.labelled").first().boundingBox()];
    expect(cal!.y).toBeGreaterThan(subj!.y + subj!.height - 1); // under the title
    expect(Math.abs(cal!.x - subj!.x)).toBeLessThanOrEqual(10); // starts where the title starts (button has its own inner padding)
  });
}

test("#196: on a laptop, Back leaves the reading pane instead of walking through every mail opened", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await open(page, "minimal", SIZES[0], smallInbox());
  for (const id of ["cat1", "fee", "hack", "notice"]) {
    await page.locator(`li.row[data-mail="${id}"] .row-main`).click();
    await expect(page.locator(".mailview.pane")).toBeVisible();
  }
  await page.goBack();
  await expect(page.locator(".mailview.pane")).toHaveCount(0);
});
