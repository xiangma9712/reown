import { test, expect } from "@playwright/test";

test.describe("AnalysisDetailPanel", () => {
  test("static analysis only", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--static-only&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "static-only.png"
    );
  });

  test("with LLM analysis", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--with-llm-analysis&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-llm-analysis.png"
    );
  });

  test("low risk", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--low-risk&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "low-risk.png"
    );
  });

  test("high risk with breaking changes", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-analysisdetailpanel--high-risk-with-breaking-changes&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "high-risk-with-breaking-changes.png"
    );
  });
});
