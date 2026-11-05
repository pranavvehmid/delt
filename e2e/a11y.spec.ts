// Issue #8: the main tasks work with a keyboard only, and axe finds no serious problems
// for screen reader users in either look, light or dark.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

async function axe(page: Page, what: string) {
  // measure the finished screen, not a fade-in halfway through
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const { violations } = await new AxeBuilder({ page } as never).exclude(".mv-frame").analyze(); // the mail itself is the sender's HTML
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${what}: ${v.id} (${v.impact}) ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

async function setLook(page: Page, look: "minimal" | "glyph", mode: "light" | "dark" | "black") {
  await page.addInitScript(([look, mode]) => localStorage.setItem("delt-prefs", JSON.stringify({ look, mode, accent: "auto", size: "normal", density: "comfortable" })), [look, mode]);
}

test.describe("axe", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
for (const look of ["minimal", "glyph"] as const) {
  for (const mode of ["light", "dark", "black"] as const) {
    test(`axe: ${look} ${mode}: inbox, mail, deadlines, settings`, async ({ page }) => {
      await setLook(page, look, mode);
      await mockApi(page, smallInbox());
      await page.goto("/e2e");
      await expect(page.locator('li.row[data-mail="cat1"]')).toBeVisible();
      await page.waitForTimeout(400);
      await axe(page, "inbox");

      await page.locator('li.row[data-mail="fee"] .row-main').click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await axe(page, "mail");
      await page.keyboard.press("Escape");

      await page.goto("/e2e#/deadlines");
      await expect(page.getByText("Hostel fee payment: last date")).toBeVisible();
      await axe(page, "deadlines");

      await page.getByRole("button", { name: "Account" }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await axe(page, "settings");
    });
  }
}

});

test.describe("keyboard only", () => {
  test.skip(({ isMobile }) => !!isMobile, "keyboard tests run on the desktop layout");

  test("open a mail with Enter, act on it, close with Esc, and land back on the same row", async ({ page }) => {
    const api = await mockApi(page, smallInbox());
    await page.goto("/e2e");
    const first = page.locator('li.row[data-mail="cat1"] .row-main');
    await expect(first).toBeVisible();
    await first.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "CAT-1 exam schedule released" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#mv-title")).toBeFocused();

    // mark done and move pile from the keyboard
    await dialog.getByRole("button", { name: "Done", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("radio", { name: "Later" }).focus();
    await page.keyboard.press("Space");
    expect(api.patches).toEqual(expect.arrayContaining([{ id: "cat1", is_done: true }, { id: "cat1", priority: "later" }]));

    // Tab stays inside the open mail
    for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".mailview"))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test("row buttons show up when tabbed to, so read/done work without a mouse or swipe", async ({ page }) => {
    const api = await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await page.locator('li.row[data-mail="hack"] .row-main').focus();
    await page.keyboard.press("Tab");
    const btn = page.locator('li.row[data-mail="hack"] .row-acts button').first();
    await expect(btn).toBeFocused();
    await expect(page.locator('li.row[data-mail="hack"] .row-acts')).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    expect(api.patches).toContainEqual({ id: "hack", read: true });
  });

  test("account menu opens from the keyboard and closes with Esc", async ({ page }) => {
    await mockApi(page, smallInbox());
    await page.goto("/e2e");
    const avatar = page.getByRole("button", { name: "Account" });
    await avatar.focus();
    await page.keyboard.press("Enter");
    await expect(avatar).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(avatar).toHaveAttribute("aria-expanded", "false");
    await expect(avatar).toBeFocused();
  });

  test("every row says what it is to a screen reader", async ({ page }) => {
    await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await expect(page.getByRole("button", { name: /^Unread\. COE: CAT-1 exam schedule released\. Urgent, / })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hostel fee payment: last date\. Urgent, .*Due / })).toBeVisible();
  });
});
