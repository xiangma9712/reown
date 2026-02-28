import { test, expect } from "@playwright/test";

test.describe("ThemeSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-themesettingstab--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("dark", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-themesettingstab--dark&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("dark.png");
  });
});
