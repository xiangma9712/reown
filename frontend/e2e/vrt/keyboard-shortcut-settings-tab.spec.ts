import { test, expect } from "@playwright/test";

test.describe("KeyboardShortcutSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-keyboardshortcutsettingstab--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("enabled", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-keyboardshortcutsettingstab--enabled&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled.png"
    );
  });

  test("dark", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-keyboardshortcutsettingstab--dark&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("dark.png");
  });

  test("click-show", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-keyboardshortcutsettingstab--click-show&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "click-show.png"
    );
  });

  test("click-hide", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-keyboardshortcutsettingstab--click-hide&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "click-hide.png"
    );
  });
});
