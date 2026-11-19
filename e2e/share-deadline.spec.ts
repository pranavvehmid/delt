import { expect, test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";

test("share a deadline card with only the reviewed fields and no sign-in (#257)", async ({ page, context }) => {
  const inbox = smallInbox();
  await mockApi(page, inbox);
  await page.goto("/e2e");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /^Deadlines/ }).click();
  await page.locator(".due-row").getByRole("button", { name: "Share deadline" }).click();
  const sheet = page.getByRole("dialog", { name: "Share deadline" });
  await sheet.getByRole("textbox", { name: "Title" }).fill("Fee reminder");
  await sheet.getByRole("textbox", { name: "Source" }).fill("Accounts Office");
  const url = new URL(await sheet.getByRole("textbox", { name: "Share link" }).inputValue());
  expect(url.search).toBe("");
  expect([...new URLSearchParams(url.hash.slice(1)).keys()].sort()).toEqual(["due", "source", "title"]);
  const recipient = await context.newPage();
  await recipient.goto(url.href);
  await expect(recipient.getByRole("heading", { name: "Fee reminder" })).toBeVisible();
  await expect(recipient.getByText("Source: Accounts Office")).toBeVisible();
  await expect(recipient.locator("time")).toHaveAttribute("datetime", inbox.find((mail) => mail.id === "fee")!.deadline!);
  await expect(recipient.getByText("Pay by tomorrow evening.")).toHaveCount(0);
});
