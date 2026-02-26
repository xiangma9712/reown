import { test, expect } from "@playwright/test";

test.describe("RiskBadge", () => {
  test("low", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-riskbadge--low&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("low.png");
  });

  test("medium", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-riskbadge--medium&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "medium.png"
    );
  });

  test("high", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-riskbadge--high&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("high.png");
  });
});
