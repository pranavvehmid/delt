import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("preview and edit a mail summary before handing it to WhatsApp (#258)", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator('li.row[data-mail="fee"] .row-main').click();
  await page.getByRole("button", { name: "Share summary" }).click();
  const share = page.getByRole("dialog", { name: "Share summary" });
  const field = share.getByRole("textbox");
  await expect(field).toHaveValue(/Hostel fee payment: last date[\s\S]*Pay by tomorrow evening\.[\s\S]*Due: .+ IST/);
  await field.fill("Payment update & due date");
  const href = await share.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href");
  const url = new URL(href!);
  expect(url.origin).toBe("https://wa.me");
  expect(url.searchParams.get("text")).toBe("Payment update & due date");
  await page.keyboard.press("Escape");
  await expect(share).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Hostel fee payment: last date" })).toBeVisible();
});
