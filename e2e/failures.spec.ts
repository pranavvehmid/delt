// What the student sees when the server says no.
import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("#231: a change the server refuses is put back, and the student is told", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "uses the hover buttons");
  await mockApi(page, smallInbox());
  await page.route("**/api/emails", (r) => (r.request().method() === "PATCH" ? r.fulfill({ status: 500, body: "{}" }) : r.fallback()));
  await page.goto("/e2e");
  const row = page.locator('li.row[data-mail="hack"]');
  await row.hover();
  await row.getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText("Couldn't save that change. It's back as it was.")).toBeVisible();
  await expect(row).not.toHaveClass(/\bdone\b/);
});

test("#231: if Mark all read fails, the mail shows unread again", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.route("**/api/emails/bulk", (r) => r.fulfill({ status: 500, body: "{}" }));
  await page.goto("/e2e");
  await expect(page.locator("li.row.unread").first()).toBeVisible();
  const unread = await page.locator("li.row.unread").count();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("Couldn't mark them read. Try again.")).toBeVisible();
  await expect(page.locator("li.row.unread")).toHaveCount(unread);
});

test("#210: when the server fails, the inbox says so and can try again", async ({ page }) => {
  await mockApi(page, smallInbox());
  let fail = true;
  await page.route("**/api/emails?*", (r) => (fail ? r.fulfill({ status: 500, body: "{}" }) : r.fallback()));
  await page.goto("/e2e");
  await expect(page.getByText("Couldn't load your mail")).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("li.row").first()).toBeVisible();
});

test("#229: a page that doesn't exist gets DELT's own page with a way back", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
  await page.getByRole("link", { name: "Go to your inbox" }).click();
  await expect(page).toHaveURL(/\/$/);
});
