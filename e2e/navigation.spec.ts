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

test("#223: the browser tab shows what needs you, and the open mail's subject", async ({ page }) => {
  const { smallInbox } = await import("./mock");
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page).toHaveTitle(/^\(\d+\) DELT$/);
  await page.locator('li.row[data-mail="hack"] .row-main').click();
  await expect(page).toHaveTitle("Hackathon registrations open · DELT");
});

test("#230: the chosen pile and Unread only survive a reload", async ({ page }) => {
  const { smallInbox } = await import("./mock");
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  const chips = page.getByRole("navigation", { name: "Filter by pile" });
  await chips.getByRole("button", { name: /^Later/ }).click();
  await page.getByText("Unread only").first().click();
  await expect(chips.getByRole("button", { name: /^Later/ })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(chips.getByRole("button", { name: /^Later/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: /Unread only/ })).toBeChecked();
});
