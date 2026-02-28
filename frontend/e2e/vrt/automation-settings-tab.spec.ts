import { test, expect } from "@playwright/test";

test.describe("AutomationSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--default&viewMode=story"
    );
    await page.waitForSelector("text=オートメーション設定", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("enabled", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled&viewMode=story"
    );
    await page.waitForSelector("text=リスクカスタマイズ", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled.png"
    );
  });

  test("enabled with auto merge", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled-with-auto-merge&viewMode=story"
    );
    await page.waitForSelector("text=マージ方法", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled-with-auto-merge.png"
    );
  });

  test("enabled with sensitive patterns", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled-with-sensitive-patterns&viewMode=story"
    );
    await page.waitForSelector("text=センシティブパスパターン", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled-with-sensitive-patterns.png"
    );
  });
});
