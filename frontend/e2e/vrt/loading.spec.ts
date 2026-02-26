import { test, expect } from "@playwright/test";

test.describe("Loading", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-loading--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("spinner small", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-loading--spinner-small&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "spinner-small.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("spinner medium", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-loading--spinner-medium&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "spinner-medium.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });
});
