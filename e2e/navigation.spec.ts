// #197, #216: tabs keep their place; tapping the tab you're on goes back to the top.
import { expect, test, type Page } from "@playwright/test";
import { mockApi, bigInbox } from "./mock";

// Press a tab without scrolling to it first (like Glyph's fixed bottom bar or the laptop top bar).
const press = (page: Page, name: string) =>
  page.evaluate((n) => [...document.querySelectorAll<HTMLButtonElement>(".mast button, .tabbar button")].find((b) => b.offsetParent && b.textContent!.startsWith(n))!.click(), name);

test("switching tabs and back returns to the same place in the inbox (#197)", async ({ page }) => {
  await mockApi(page, bigInbox(80));
  await page.goto("/e2e");
  await expect(page.locator("li.row").nth(40)).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(1500);
  await press(page, "Deadlines");
  await expect(page).toHaveURL(/#\/deadlines/);
  await press(page, "Inbox");
  await expect.poll(() => page.evaluate(() => Math.round(scrollY)), { timeout: 3000 }).toBe(1500);
});

test("tapping the tab you're on scrolls back to the top (#216)", async ({ page }) => {
  await mockApi(page, bigInbox(80));
  await page.goto("/e2e");
  await expect(page.locator("li.row").nth(40)).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await press(page, "Inbox");
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
});
