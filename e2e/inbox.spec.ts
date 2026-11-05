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
  await expect(page.getByRole("status").filter({ hasText: "Moved to Noise. New mail from COE will go there too." })).toBeVisible();
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

test("sorting rules: moving a mail adds a rule for that sender, and it can be removed (#13)", async ({ page }) => {
  const api = await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator(row("promo")).locator(".row-main").click();
  await page.getByRole("radio", { name: "Later" }).click();
  await page.getByRole("button", { name: "Back to list" }).click();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sorting rules" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const rule = dialog.getByRole("listitem").filter({ hasText: "Coursera" });
  await expect(rule).toContainText("Later");
  await rule.getByRole("button", { name: /Remove rule/ }).click();
  await expect(rule).toHaveCount(0);
  await expect(dialog.getByText("None yet.")).toBeVisible();
  expect(api.forgotten).toEqual(["no-reply@coursera.org"]);
});

test("offline: the saved inbox shows, marked offline, and changes are paused (#14)", async ({ page, context }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page.locator(row("cat1"))).toBeVisible();
  await page.waitForTimeout(1200); // the copy is saved shortly after the list loads

  // a fresh start with no connection to the API: the saved list appears straight away
  await page.unroute("**/api/**");
  await page.route("**/api/**", (r) => r.abort("internetdisconnected"));
  await page.reload();
  await expect(page.locator(row("cat1"))).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "You're offline" })).toBeVisible();

  await page.locator(row("hack")).locator(".row-main").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Changes are paused until you're back online.").last()).toBeVisible();
  await expect(page.locator(row("hack"))).toHaveClass(/unread/);

  // back online: the banner goes
  await page.unroute("**/api/**");
  await mockApi(page, smallInbox());
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "You're offline" })).toHaveCount(0);
});

test("iPhone: tapping search doesn't zoom the page, and nothing scrolls sideways (#17)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone screens only");
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  const box = page.getByRole("textbox", { name: "Search mail" });
  expect(await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.locator(row("cat1")).locator(".row-main").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("AI is off until the student answers, once (#31)", async ({ page }) => {
  await mockApi(page, smallInbox(), { aiConsent: null });
  await page.goto("/e2e");
  const ask = page.getByRole("region", { name: "Let AI double-check unclear mail?" });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  // both answers look the same (#44)
  const look = (name: string) => ask.getByRole("button", { name }).evaluate((b) => { const s = getComputedStyle(b); return [s.backgroundColor, s.color, s.fontWeight, s.borderTopWidth].join(); });
  expect(await look("Allow AI")).toBe(await look("Rules only"));
  await ask.getByRole("button", { name: "Rules only" }).click();
  await expect(ask).toHaveCount(0);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("checkbox", { name: "Use AI for unclear mail" })).not.toBeChecked();
});

test("the Android app offers its own update when a newer build is out", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ name: "DELT for Android (build 6)" }) }));
  await page.goto("/e2e?app=4#/inbox");
  const banner = page.getByRole("region", { name: "A new version of the DELT app is ready." });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("link", { name: "Update" })).toHaveAttribute("href", "https://github.com/pranavvehmid/delt/releases/download/app-latest/DELT.apk");
  await banner.getByRole("button", { name: "Later" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.locator(row("cat1"))).toBeVisible();
  await expect(banner).toHaveCount(0); // snoozed for a few days
});

test("no update banner for an up-to-date app or a normal browser", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ name: "DELT for Android (build 6)" }) }));
  await page.goto("/e2e?app=6#/inbox");
  await expect(page.locator(row("cat1"))).toBeVisible();
  await expect(page.getByText("A new version of the DELT app is ready.")).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
  await page.goto("/e2e#/inbox");
  await expect(page.locator(row("cat1"))).toBeVisible();
  await expect(page.getByText("A new version of the DELT app is ready.")).toHaveCount(0);
});

test("the mail frame fits the mail: short mail, short box; long mail, all of it (#45)", async ({ page }) => {
  await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator(row("cat1")).locator(".row-main").click();
  await expect(page.frameLocator(".mv-frame").getByText("Full text of")).toBeVisible();
  await expect.poll(async () => (await page.locator(".mv-frame").boundingBox())!.height).toBeLessThan(140);
  await page.getByRole("button", { name: "Back to list" }).click();
  await page.locator(row("news")).locator(".row-main").click();
  await expect(page.frameLocator(".mv-frame").getByText("Paragraph 40 of")).toBeAttached();
  await expect.poll(async () => (await page.locator(".mv-frame").boundingBox())!.height).toBeGreaterThan(900);
});

test("moving a mail says it makes a rule, and 'Just this one' moves it without one (#46)", async ({ page }) => {
  const api = await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await page.locator(row("promo")).locator(".row-main").click();
  await page.getByRole("radio", { name: "Later" }).click();
  const toast = page.getByRole("status").filter({ hasText: "New mail from Coursera will go there too." });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Just this one" }).click();
  await expect(page.getByRole("status").filter({ hasText: "no rule for Coursera" })).toBeVisible();
  expect(api.patches.at(-1)).toEqual({ id: "promo", priority: "later", teach: false });
  await page.getByRole("button", { name: "Back to list" }).click();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sorting rules" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" }).getByText("None yet.")).toBeVisible();
});

test("Mark all read can be undone (#47)", async ({ page }) => {
  const api = await mockApi(page, smallInbox());
  await page.goto("/e2e");
  await expect(page.locator("li.row.unread")).toHaveCount(4);
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.locator("li.row.unread")).toHaveCount(0);
  await page.getByRole("status").filter({ hasText: "4 marked read" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("li.row.unread")).toHaveCount(4);
  await expect.poll(() => api.bulk.length).toBe(2);
  expect(api.bulk[1].read).toBe(false);
  expect(new Set(api.bulk[1].ids)).toEqual(new Set(api.bulk[0].ids));
});
