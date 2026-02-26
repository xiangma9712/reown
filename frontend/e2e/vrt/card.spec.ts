import { test, expect } from "@playwright/test";

test.describe("Card", () => {
  test("card default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-card--card-default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "card-default.png"
    );
  });

  test("panel default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-card--panel-default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "panel-default.png"
    );
  });

  test("card with panel", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-card--card-with-panel&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "card-with-panel.png"
    );
  });
});
