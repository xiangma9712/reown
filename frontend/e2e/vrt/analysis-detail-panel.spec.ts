import { test, expect } from "@playwright/test";

test.describe("AnalysisDetailPanel", () => {
  test("static only", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--static-only&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "static-only.png"
    );
  });

  test("with hybrid result", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--with-hybrid-result&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-hybrid-result.png"
    );
  });

  test("risk low", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--risk-low&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "risk-low.png"
    );
  });

  test("risk high", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--risk-high&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "risk-high.png"
    );
  });
});
