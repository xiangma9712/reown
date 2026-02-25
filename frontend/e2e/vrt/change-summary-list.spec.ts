import { test, expect } from "@playwright/test";

test.describe("ChangeSummaryList", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--default&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with summary", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--with-summary&viewMode=story"
    );
    // Wait for summary to be generated (async invoke)
    await page.locator("#storybook-root h3").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-summary.png"
    );
  });

  test("streaming state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--streaming&viewMode=story"
    );
    // Wait for streaming text to appear
    await page.waitForTimeout(2500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "streaming.png",
      { maxDiffPixelRatio: 0.03 }
    );
  });

  test("empty diffs", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--empty-diffs&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "empty-diffs.png"
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--error&viewMode=story"
    );
    // Wait for error message to appear
    await page.locator("#storybook-root").waitFor();
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "error.png"
    );
  });
});
