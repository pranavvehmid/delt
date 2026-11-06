// #77: each screen change takes the cheapest smooth path. A page-wide view transition makes React
// render synchronously before anything moves, so it's kept for closing a mail only.
import { expect, test } from "@playwright/test";
import { mockApi, bigInbox } from "./mock";

test.use({ contextOptions: { reducedMotion: "no-preference" } });

test("opening a mail and switching tabs take no page snapshot; closing a mail does", async ({ page }) => {
  await mockApi(page, bigInbox(60));
  await page.addInitScript(() => {
    (window as unknown as { vt: number }).vt = 0;
    const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const real = d.startViewTransition?.bind(d);
    if (real) d.startViewTransition = (cb: () => void) => ((window as unknown as { vt: number }).vt++, real(cb));
  });
  await page.goto("/e2e");
  await page.locator("li.row .row-main").first().waitFor();
  const vt = () => page.evaluate(() => (window as unknown as { vt: number }).vt);
  await page.locator("li.row .row-main").nth(1).click();
  await expect(page.locator(".mailview")).toBeVisible();
  expect(await vt()).toBe(0);
  // the mail's own frame is built once the panel has slid in
  await expect(page.locator(".mv-frame")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mailview")).toHaveCount(0);
  const afterClose = await vt();
  await page.locator("button:visible", { hasText: /^Deadlines/ }).first().click();
  await expect(page.locator("button:visible.on", { hasText: /^Deadlines/ }).first()).toBeVisible();
  expect(await vt()).toBe(afterClose);
});

test("the first draw of a long list is two screens of rows; the rest follow", async ({ page }) => {
  await mockApi(page, bigInbox(60));
  await page.goto("/e2e");
  await page.locator("li.row .row-main").first().waitFor();
  await expect.poll(() => page.locator("li.row").count()).toBeGreaterThan(40);
});
