import { expect, test } from "@playwright/test";
import { campusVenues } from "../src/lib/campus-venues";
import { mockApi, smallInbox } from "./mock";

test("recognized campus venues open a map from the mail reader (#273)", async ({ page }) => {
  const mail = smallInbox();
  await mockApi(page, mail);
  await page.route("**/api/emails/cat1", (route) => route.fulfill({
    json: {
      subject: mail[0].subject,
      from: mail[0].from_name,
      date: mail[0].received_at,
      text: "Meet at SJT 501.",
      attachments: [],
      venues: campusVenues(mail[0].user_email, "Meet at SJT 501."),
    },
  }));
  await page.goto("/e2e");
  await page.locator('li.row[data-mail="cat1"] .row-main').click();
  const venue = page.getByRole("list", { name: "VIT Vellore venues on Google Maps" })
    .getByRole("link", { name: "Silver Jubilee Tower" });
  await expect(venue).toBeVisible();
  await expect(venue).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Silver\+Jubilee\+Tower/);
});
