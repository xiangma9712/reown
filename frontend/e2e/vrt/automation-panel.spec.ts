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
    // Wait for the evaluate to complete and empty state message to appear
    await page.waitForSelector("text=自動Approveの対象となるPRはありません", {
      timeout: 10_000,
    });
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
    // Wait for evaluate to finish and confirm dialog with candidates to appear
    await page.waitForSelector("text=#38", { timeout: 10_000 });
    await expect(page).toHaveScreenshot("with-candidates.png", {
      fullPage: true,
    });
  });
});
