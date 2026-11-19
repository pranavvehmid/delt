import { expect, test, type Locator } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

async function expectInsideViewport(controls: Locator) {
  await expect.poll(async () => {
    const bounds = await controls.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5;
    }));
    return bounds.length > 0 && bounds.every(Boolean);
  }).toBe(true);
}

for (const look of ["minimal", "glyph", "grid"] as const) {
  test(`${look}: a 360px phone can reach filters, mail actions and deadlines (#204)`, async ({ page }) => {
    await page.addInitScript((look) => localStorage.setItem("delt-prefs", JSON.stringify({ look })), look);
    await mockApi(page, smallInbox());
    await page.goto("/e2e");
    const filters = page.getByRole("navigation", { name: "Filter by pile" });
    await expect(filters.getByRole("button")).toHaveCount(5);
    await expectInsideViewport(filters.getByRole("button"));
    const sections = page.getByRole("navigation", { name: "Sections" });
    await expectInsideViewport(sections.getByRole("button"));
    await filters.getByRole("button", { name: /^Noise/ }).click();
    await page.locator('li.row[data-mail="promo"] .row-main').click();
    const mail = page.getByRole("dialog");
    await expect(mail.getByRole("button", { name: "Back to list" })).toBeVisible();
    await expectInsideViewport(mail.locator(".mv-bar :is(button, a)"));
    await mail.getByRole("button", { name: "Done" }).click();
    await expect(mail.getByRole("button", { name: /Done/ })).toHaveAttribute("aria-pressed", "true");
    await mail.getByRole("button", { name: "Back to list" }).click();
    await sections.getByRole("button", { name: /^Deadlines/ }).click();
    await expect(page.locator(".due-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  });
}
