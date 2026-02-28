import { test, expect } from "@playwright/test";

test.describe("FileDiffLegend", () => {
  test("default (ja)", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filedifflegend--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("english", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filedifflegend--english&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "english.png"
    );
  });
});
