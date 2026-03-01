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

  test("switch-to-dark", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-themesettingstab--switch-to-dark&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "switch-to-dark.png"
    );
  });

  test("switch-to-system", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-themesettingstab--switch-to-system&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "switch-to-system.png"
    );
  });

  test("keyboard-navigation", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-themesettingstab--keyboard-navigation&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "keyboard-navigation.png"
    );
  });
});
