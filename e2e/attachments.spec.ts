// #72: photos and PDFs in a mail can be seen in DELT.
import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

async function openHack(page: import("@playwright/test").Page) {
  const api = await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator('li.row[data-mail="hack"] .row-main').click();
  await expect(page.locator(".mv-att")).toBeVisible();
  return api;
}

test("the poster inside the mail shows without 'Load images', and isn't listed again", async ({ page }) => {
  const api = await openHack(page);
  const poster = page.frameLocator(".mv-frame").getByAltText("Hackathon poster");
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Load images" })).toHaveCount(0);
  expect(api.attachments).toContain("0.1");
  await expect(page.getByRole("button", { name: "View image.png" })).toHaveCount(0);
});

test("photos show as thumbnails and open in a viewer; arrows step, Esc closes back to the mail", async ({ page }) => {
  await openHack(page);
  const thumbs = page.locator(".att-thumb img");
  await expect(thumbs).toHaveCount(2);
  await expect.poll(() => thumbs.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "View team.jpg" }).click();
  const viewer = page.getByRole("dialog", { name: "team.jpg" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("download", "team.jpg");
  await expect(viewer.getByText("1 of 2")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "stage.png" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".att-viewer")).toHaveCount(0);
  // the mail is still open, and focus went back to the thumbnail
  await expect(page.locator(".mailview")).toBeVisible();
  await expect(page.getByRole("button", { name: "View team.jpg" })).toBeFocused();
});

test("the phone's Back button closes the photo, not the mail", async ({ page }) => {
  await openHack(page);
  await page.getByRole("button", { name: "View team.jpg" }).click();
  await expect(page.locator(".att-viewer")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".att-viewer")).toHaveCount(0);
  await expect(page.locator(".mailview")).toBeVisible();
});

test("a PDF opens in the browser's viewer; other files download; huge files go to Gmail", async ({ page }) => {
  await openHack(page);
  const pdf = page.locator(".att", { hasText: "Brochure.pdf" });
  await expect(pdf).toHaveAttribute("href", "/api/emails/hack/attachments/1");
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(pdf.locator(".att-kind")).toHaveText("PDF");
  const doc = page.locator(".att", { hasText: "Rules.docx" });
  await expect(doc).toHaveAttribute("download", "Rules.docx");
  await expect(doc.locator(".att-kind")).toHaveText("DOCX");
  const big = page.locator(".att", { hasText: "Recording.zip" });
  await expect(big).toHaveAttribute("href", /mail\.google\.com/);
  await expect(big).toContainText("Open in Gmail");
});

test("the real attachment route refuses anyone who isn't signed in", async ({ request }) => {
  const res = await request.get("/api/emails/hack/attachments/1");
  expect(res.status()).toBe(401);
});

test("a mail with no files shows no attachment section", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator('li.row[data-mail="cat1"] .row-main').click();
  await expect(page.frameLocator(".mv-frame").getByText("Full text of")).toBeVisible();
  await expect(page.locator(".mv-att")).toHaveCount(0);
});
