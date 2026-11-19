import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("mail font, text size and line spacing apply to styled mail and survive reload (#275)", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.route("**/api/emails/fee", (route) => route.fulfill({ json: {
    subject: "Hostel fee payment: last date",
    html: '<p style="font: 12px/14px Georgia !important">Fee notice <strong style="font-size: 18px">Due today</strong></p>',
    attachments: [],
  } }));
  await page.goto("/e2e");
  const fee = page.locator('li.row[data-mail="fee"] .row-main');
  await expect(fee).toBeVisible();
  await page.getByRole("button", { name: "Appearance" }).click();
  const appearance = page.getByRole("dialog", { name: "Appearance" });
  await expect(appearance.getByRole("group", { name: "Reading mail" })).toBeVisible();
  await appearance.getByRole("combobox", { name: "Font", exact: true }).selectOption("opendyslexic");
  await appearance.getByRole("combobox", { name: "Mail text size" }).selectOption("largest");
  await appearance.getByRole("combobox", { name: "Line spacing" }).selectOption("wide");
  await appearance.getByRole("button", { name: "Done" }).click();
  await page.reload();

  await fee.click();
  const mail = page.frameLocator('iframe[title="Mail content"]');
  const paragraph = mail.getByText("Fee notice");
  await expect(paragraph).toHaveCSS("font-family", /DELTReading/);
  await expect.poll(() => paragraph.evaluate((el) =>
    [...el.ownerDocument.fonts].some((font) => font.family === "DELTReading" && font.status === "loaded"),
  )).toBe(true);
  await expect(paragraph).toHaveCSS("font-size", "16.8px");
  await expect(paragraph).toHaveCSS("line-height", "33.6px");
  await expect(mail.getByText("Due today")).toHaveCSS("font-size", "25.2px");
  await expect(page.locator('iframe[title="Mail content"]')).toHaveAttribute("srcdoc", /font-src data:;/);
});
