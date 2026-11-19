import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("Settings downloads the account export with this device's appearance (#268)", async ({ page }) => {
  const mails = smallInbox();
  await mockApi(page, mails);
  await page.addInitScript(() => localStorage.setItem("delt-prefs", JSON.stringify({ look: "grid" })));
  await page.route("**/api/account", (route) => route.fulfill({
    json: { version: 1, previews: [{ id: mails[0].id }], rules: [], settings: { aiConsent: false } },
  }));
  await page.goto("/e2e");
  await page.getByRole("button", { name: "Account" }).click();
  await page.locator("#acct-menu .menu-item", { hasText: /^Settings$/ }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Download my data" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("delt-data.json");
  const data = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(data).toMatchObject({
    version: 1, previews: [{ id: mails[0].id }], rules: [], settings: { aiConsent: false }, thisDevice: { look: "grid" },
  });
});
