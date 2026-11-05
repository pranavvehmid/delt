import { test } from "@playwright/test";
import { mockApi, smallInbox } from "./mock";
for (const [look, mode] of [["minimal", "light"], ["glyph", "dark"], ["grid", "dark"]]) {
  test("toggle " + look, async ({ page }) => {
    await page.addInitScript(([l, m]) => localStorage.setItem("delt-prefs", JSON.stringify({ look: l, mode: m, accent: "auto", size: "normal", density: "comfortable" })), [look, mode]);
    await mockApi(page, smallInbox());
    await page.goto("/e2e");
    await page.waitForTimeout(800);
    const box = await page.locator(".listbar").boundingBox();
    await page.screenshot({ path: "C:/Users/ADMIN/AppData/Local/Temp/claude/8d48ce917d0f30b1/d359da32-1093-4eda-8e5f-46fab10291c8/scratchpad/toggle-" + look + ".png", clip: { x: 0, y: box!.y - 6, width: 412, height: box!.height + 12 } });
  });
}
