import { test, expect } from "@playwright/test";

test.describe("Dropdown", () => {
  test("closed", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-dropdown--closed&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "closed.png"
    );
  });

  test("open", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-dropdown--open&viewMode=story"
    );
    // play関数でドロップダウンが開かれるのを待つ
    await page.waitForSelector("text=削除", { timeout: 10_000 });
    // Portalでbodyにレンダリングされるためフルページをキャプチャ
    await expect(page).toHaveScreenshot("open.png");
  });
});
