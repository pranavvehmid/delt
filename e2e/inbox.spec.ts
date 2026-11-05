// Issue #12: the main screens in a real browser, with fake mail (see mock.ts).
import { expect, test } from "@playwright/test";
import { bigInbox, mockApi, smallInbox, swipe } from "./mock";

const row = (id: string) => `li.row[data-mail="${id}"]`;

test.describe("swiping (phone)", () => {
  test.skip(({ isMobile }) => !isMobile, "swipes are a touch gesture");

  test("swipe right marks read, swipe right again marks unread", async ({ page }) => {
    const api = await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await expect(page.locator(row("cat1"))).toHaveClass(/unread/);
    await swipe(page, row("cat1"), 130);
    await expect(page.locator(row("cat1"))).not.toHaveClass(/unread/);
    await expect(page.getByRole("status").filter({ hasText: "Marked read" })).toBeVisible();
    expect(api.patches).toContainEqual({ id: "cat1", read: true });
    await swipe(page, row("cat1"), 130);
    await expect(page.locator(row("cat1"))).toHaveClass(/unread/);
  });

  test("swipe left marks done, and Undo puts it back", async ({ page }) => {
    const api = await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await swipe(page, row("hack"), -130);
    await expect(page.locator(row("hack"))).toHaveClass(/done/);
    expect(api.patches).toContainEqual({ id: "hack", is_done: true });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(row("hack"))).not.toHaveClass(/done/);
  });

  test("a short drag does nothing, and a swipe never opens the mail", async ({ page }) => {
    const api = await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await swipe(page, row("club"), 40);
    await swipe(page, row("club"), 130);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(api.patches.filter((p) => p.id === "club")).toEqual([{ id: "club", read: true }]);
  });
});

test("open a mail, read it, and go back (button and browser Back)", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator(row("cat1")).locator(".row-main").click();
  const dialog = page.getByRole("dialog", { name: "CAT-1 exam schedule released" });
  await expect(dialog).toBeVisible();
  await expect(page.frameLocator(".mv-frame").getByText("Full text of")).toBeVisible();
  await expect(page).toHaveURL(/#\/mail\/cat1$/);
  // opening marks it read
  await expect(dialog.getByRole("button", { name: "Mark unread" })).toBeVisible();

  await dialog.getByRole("button", { name: "Back to list" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(row("cat1"))).not.toHaveClass(/unread/);

  await page.locator(row("fee")).locator(".row-main").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(row("fee"))).toBeVisible();
});

test("move a mail to another pile, then find it under that pile and under All", async ({ page }) => {
  const api = await mockApi(page, smallInbox());
  await page.goto("/e2e");
  const chips = page.getByRole("navigation", { name: "Filter by pile" });
  await page.locator(row("cat1")).locator(".row-main").click();
  await page.getByRole("radio", { name: "Noise" }).click();
  await expect(page.getByRole("radio", { name: "Noise" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("status").filter({ hasText: "Moved to Noise" })).toBeVisible();
  expect(api.patches).toContainEqual({ id: "cat1", priority: "noise" });
  await page.getByRole("button", { name: "Back to list" }).click();

  await chips.getByRole("button", { name: /^Noise/ }).click();
  await expect(page.locator(row("cat1"))).toBeVisible();
  await chips.getByRole("button", { name: /^Urgent/ }).click();
  await expect(page.locator(row("cat1"))).toHaveCount(0);
  await expect(page.locator(row("fee"))).toBeVisible();
  await chips.getByRole("button", { name: /^All/ }).click();
  await expect(page.locator(row("cat1"))).toBeVisible();
});

test("Deadlines tab lists mail with a due date", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.getByRole("navigation", { name: "Sections" }).first().getByRole("button", { name: /Deadlines/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/#\/deadlines$/);
  await expect(page.getByText("Hostel fee payment: last date")).toBeVisible();
  await expect(page.getByText("CAT-1 exam schedule released")).toHaveCount(0);
});

test("a busy inbox loads older mail on scroll, and search finds mail that isn't loaded", async ({ page }) => {
  test.setTimeout(90_000); // 450 mails
  const api = await mockApi(page, bigInbox(450));
  await page.goto("/e2e");
  await expect(page.locator(row("m0"))).toBeVisible();
  await expect(page.locator("li.row")).toHaveCount(200);

  await page.getByRole("button", { name: "Load older mail" }).scrollIntoViewIfNeeded();
  await expect(page.locator(row("m398"))).toBeAttached(); // pages overlap by one mail on purpose
  await page.getByRole("button", { name: "Load older mail" }).scrollIntoViewIfNeeded();
  await expect(page.locator(row("ancient"))).toBeAttached();
  await expect(page.getByText("That's all your mail in DELT")).toBeVisible();
  expect(new Set(await page.locator("li.row").evaluateAll((els) => els.map((e) => e.getAttribute("data-mail")))).size).toBe(451);
  expect(api.emailRequests.some((s) => s.includes("before="))).toBe(true);

  // a fresh start, then search reaches the old mail on the server
  await page.reload();
  await expect(page.locator("li.row")).toHaveCount(200);
  await page.getByRole("textbox", { name: "Search mail" }).fill("scholarship");
  await expect(page.locator(row("ancient"))).toBeVisible();
  expect(api.emailRequests.some((s) => s.includes("q=scholarship"))).toBe(true);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(row("ancient"))).toHaveCount(0);
});

test("removed Google access shows a Sign in again banner", async ({ page }) => {
  await mockApi(page, smallInbox(), { reauth: true });
  await page.goto("/e2e");
  const banner = page.getByRole("alert").filter({ hasText: "can't reach your Gmail" });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button", { name: "Sign in again" })).toBeVisible();
});

test("Delete my data asks first, then deletes and signs out", async ({ page }) => {
  const api = await mockApi(page, smallInbox());
  await page.route("**/?deleted=1", (r) => r.fulfill({ contentType: "text/html", body: "<p>deleted page</p>" }));
  await page.goto("/e2e");
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Delete my data" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Delete my data" }).click();
  await expect(dialog.getByText("This can't be undone.")).toBeVisible();
  expect(api.deleted).toHaveLength(0);
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL(/\?deleted=1$/);
  expect(api.deleted).toEqual([{ removeLabels: true }]);
});
