import { test, expect } from "@playwright/test";

test.describe("AutomationPanel", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationpanel--default&viewMode=story"
    );
    await page.waitForSelector("text=オートメーション実行", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("no candidates", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationpanel--no-candidates&viewMode=story"
    );
    await page.waitForSelector("text=オートメーション実行", {
      timeout: 10_000,
    });
    // Wait for the evaluate to complete (no candidates message appears in idle)
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "no-candidates.png"
    );
  });

  test("with candidates", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationpanel--with-candidates&viewMode=story"
    );
    await page.waitForSelector("text=オートメーション実行", {
      timeout: 10_000,
    });
    // Wait for evaluate to finish and candidates to appear
    await page.waitForSelector("text=#38", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-candidates.png"
    );
  });
});
