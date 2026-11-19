import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("the keyboard palette navigates, searches by sender, and moves an open mail (#270)", async ({ page }) => {
  const mails = smallInbox().map((mail) => mail.id === "club" ? { ...mail, from_address: "photo.club@vit.ac.in" } : mail);
  const api = await mockApi(page, mails);
  await page.goto("/e2e");
  await expect(page.locator("li.row").first()).toBeVisible();
  const field = page.getByRole("combobox", { name: "Find a command or sender" });
  const open = () => page.keyboard.press("Control+k");

  await open();
  await expect(field).toBeFocused();
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(page.locator(".due-row").first()).toBeVisible();

  await open();
  await field.fill("Photo Club");
  await expect(page.getByRole("option", { name: /Mail from Photo Club/ })).toBeVisible();
  await field.press("Enter");
  await expect(page.getByRole("textbox", { name: "Search mail" })).toHaveValue("photo.club@vit.ac.in");
  const club = page.locator('li.row[data-mail="club"] .row-main');
  await club.click();
  await expect(page.getByRole("dialog", { name: "Photography club meetup" })).toBeVisible();

  await open();
  await field.fill("move mail to urgent");
  await field.press("Enter");
  await expect.poll(() => api.patches).toContainEqual({ id: "club", priority: "very_important" });
});
