// Issue #12: every option in the Appearance panel applies, survives a reload, and doesn't break the layout.
import { expect, test, type Page } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

const html = (page: Page) => page.locator("html");
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function openPanel(page: Page) {
  await page.getByRole("button", { name: "Appearance" }).click();
  const panel = page.getByRole("dialog", { name: "Appearance" });
  await expect(panel).toBeVisible();
  return panel;
}

for (const look of ["Minimal", "Glyph"] as const) {
  test(`${look}: every theme applies, with no sideways scrolling`, async ({ page }) => {
    await mockApi(page, smallInbox());
    await page.goto("/e2e");
    const panel = await openPanel(page);
    await panel.getByRole("radio", { name: new RegExp(look) }).click();
    await expect(html(page)).toHaveAttribute("data-look", look.toLowerCase());

    const themes = [
      ["Light", "light", "normal"],
      ["Dark", "dark", "normal"],
      ["Extra dark", "dark", "black"],
    ] as const;
    for (const [name, theme, tone] of themes) {
      await panel.getByRole("radio", { name, exact: true }).click();
      await expect(html(page)).toHaveAttribute("data-theme", theme);
      await expect(html(page)).toHaveAttribute("data-tone", tone);
      expect(await noSideScroll(page)).toBe(true);
    }

    // Auto follows the phone's setting, live
    await page.emulateMedia({ colorScheme: "dark" });
    await panel.getByRole("radio", { name: "Auto", exact: true }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "light");

    // the background really changes between light and extra dark
    await panel.getByRole("radio", { name: "Light", exact: true }).click();
    await page.waitForTimeout(450); // colours cross-fade
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await panel.getByRole("radio", { name: "Extra dark", exact: true }).click();
    await page.waitForTimeout(450);
    const blackBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(blackBg).not.toBe(lightBg);
  });
}

test("accent, text size and spacing apply and are remembered after a reload", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  let panel = await openPanel(page);
  for (const [name, key] of [["Purple", "purple"], ["Blue", "blue"], ["Green", "green"], ["Red", "red"], ["Gold", "gold"], ["Default", "auto"]] as const) {
    await panel.getByRole("radio", { name, exact: true }).click();
    await expect(html(page)).toHaveAttribute("data-accent", key);
  }
  await panel.getByRole("radio", { name: "Blue", exact: true }).click();
  await panel.getByRole("radio", { name: "Large", exact: true }).click();
  await expect(html(page)).toHaveAttribute("data-size", "large");
  await panel.getByRole("radio", { name: "Compact", exact: true }).click();
  await expect(html(page)).toHaveAttribute("data-density", "compact");
  await panel.getByRole("radio", { name: /Glyph/ }).click();
  await panel.getByRole("radio", { name: "Dark", exact: true }).click();
  expect(await noSideScroll(page)).toBe(true);

  await page.reload();
  // applied before the first paint, from what was saved
  await expect(html(page)).toHaveAttribute("data-look", "glyph");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(html(page)).toHaveAttribute("data-accent", "blue");
  await expect(html(page)).toHaveAttribute("data-size", "large");
  await expect(html(page)).toHaveAttribute("data-density", "compact");
  panel = await openPanel(page);
  await expect(panel.getByRole("radio", { name: "Large", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("the panel closes with Done, Esc, or a tap outside", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  let panel = await openPanel(page);
  await panel.getByRole("button", { name: "Done" }).click();
  await expect(panel).toHaveCount(0);
  panel = await openPanel(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  panel = await openPanel(page);
  await page.locator(".veil").click({ position: { x: 10, y: 10 } });
  await expect(panel).toHaveCount(0);
});

test("Extra dark: the mail itself is shown dark, with a switch back to original colours (#26)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("delt-prefs", JSON.stringify({ look: "minimal", mode: "black", accent: "auto", size: "normal", density: "comfortable" })));
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  expect(await page.locator('meta[name="theme-color"]').first().getAttribute("content")).toBe("#000000");
  await page.locator('li.row[data-mail="fee"] .row-main').click();
  const frame = page.locator(".mv-frame");
  await expect(frame).toHaveClass(/dim/);
  await page.getByRole("button", { name: "Original colours" }).click();
  await expect(frame).not.toHaveClass(/dim/);
  await page.getByRole("button", { name: "Show dark" }).click();
  await expect(frame).toHaveClass(/dim/);
});

test("Light theme: mail keeps its own colours", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator('li.row[data-mail="fee"] .row-main').click();
  await expect(page.locator(".mv-frame")).not.toHaveClass(/dim/);
  await expect(page.getByRole("button", { name: "Original colours" })).toHaveCount(0);
});

test("Grid (F1-inspired): always dark, its own driver colours, and back to Minimal cleanly", async ({ page }) => {
  test.setTimeout(60_000); // eight colour changes, each a cross-fade
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  const panel = await openPanel(page);
  await panel.getByRole("radio", { name: /Grid/ }).click();
  await expect(html(page)).toHaveAttribute("data-look", "grid");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  // only Dark and Extra dark
  await expect(panel.getByRole("radio", { name: "Light", exact: true })).toHaveCount(0);
  await panel.getByRole("radio", { name: "Extra dark", exact: true }).click();
  await expect(html(page)).toHaveAttribute("data-tone", "black");
  for (const [name, key] of [["Teal", "teal"], ["Navy", "navy"], ["Racing green", "racing"], ["Sky", "sky"], ["Pink", "pink"], ["Black and gold", "gold"], ["Race red", "auto"], ["Papaya", "papaya"]] as const) {
    await panel.getByRole("radio", { name, exact: true }).click();
    await expect(html(page)).toHaveAttribute("data-accent", key);
  }
  expect(await noSideScroll(page)).toBe(true);
  // the racing typeface is in use
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".mast button")!).fontStyle)).toBe("italic");

  // Minimal doesn't have papaya: it falls back to its default
  await panel.getByRole("radio", { name: /Minimal/ }).click();
  await expect(html(page)).toHaveAttribute("data-look", "minimal");
  await expect(html(page)).toHaveAttribute("data-accent", "auto");
});

test("the DELT logo is the same Minimal wordmark in every look and theme", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  const shape = () =>
    page.locator("header .logo").evaluate((el) => {
      const s = getComputedStyle(el), dot = getComputedStyle(el.querySelector("i")!);
      return { font: s.fontFamily.split(",")[0], weight: s.fontWeight, style: s.fontStyle, size: s.fontSize, spacing: s.letterSpacing, bg: s.backgroundColor, dot: dot.borderRadius, dotW: dot.width };
    });
  const reference = await shape();
  expect(reference.weight).toBe("700");
  const panel = await openPanel(page);
  for (const look of ["Glyph", "Grid", "Minimal"]) {
    await panel.getByRole("radio", { name: new RegExp(look) }).click();
    for (const theme of look === "Grid" ? ["Dark", "Extra dark"] : ["Light", "Dark", "Extra dark"]) {
      await panel.getByRole("radio", { name: theme, exact: true }).click();
      expect(await shape(), `${look} ${theme}`).toEqual(reference);
    }
  }
});

test.describe("with animations on", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });
  test("opening and closing a mail, a panel, and switching theme all still work", async ({ page }) => {
    await mockApi(page, smallInbox());
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/e2e");
    await page.locator('li.row[data-mail="cat1"] .row-main').click();
    await expect(page.getByRole("dialog", { name: "CAT-1 exam schedule released" })).toBeVisible();
    await page.getByRole("button", { name: "Back to list" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const panel = await openPanel(page);
    await panel.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
