// #80: a plain browser tab (maybe a shared lab computer) never keeps the signed-in page offline.
import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test.use({ serviceWorkers: "allow" });

test("in a browser tab, the service worker doesn't cache the signed-in page", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page.locator("li.row").first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the worker, so this navigation goes through it
  await expect(page.locator("li.row").first()).toBeVisible();
  await page.waitForTimeout(500);
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });
  expect(cached.filter((p) => !p.startsWith("/_next/") && !p.startsWith("/icons/"))).toEqual([]);
});
