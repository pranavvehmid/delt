import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("view a deadline in week and month calendars and open its source mail (#246)", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-10T10:00:00+05:30"));
  const mails = smallInbox();
  const fee = mails.find((mail) => mail.id === "fee")!;
  fee.deadline = "2026-11-11T12:30:00+05:30";
  fee.category = "deadline";
  await mockApi(page, mails);
  await page.goto("/e2e");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^Deadlines/ }).click();
  await page.getByRole("group", { name: "Deadlines view" }).getByRole("button", { name: "Calendar" }).click();
  const calendar = page.getByRole("region", { name: "Deadline calendar" });
  const dueDay = calendar.getByRole("button", { name: /11 November,? 2026, 1 deadline/i });
  await dueDay.click();
  await expect(calendar.getByRole("region", { name: /11 November,? 2026/ }).getByText("Fees")).toBeVisible();
  await calendar.getByRole("button", { name: "Month", exact: true }).click();
  await expect(calendar.getByRole("heading", { name: "November 2026", exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Next month" }).click();
  await expect(calendar.getByRole("heading", { name: "December 2026", exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Today" }).click();
  await dueDay.click();
  await calendar.getByRole("button", { name: /Hostel fee payment: last date/ }).click();
  await expect(page.getByRole("dialog", { name: "Hostel fee payment: last date" })).toBeVisible();
});
