import { test, expect } from "@playwright/test";

test.describe("PrSummaryPanel", () => {
  test("initial", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prsummarypanel--initial&viewMode=story"
    );
    await page.waitForSelector("text=PR要約", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "initial.png"
    );
  });

  test("loading", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prsummarypanel--loading&viewMode=story"
    );
    await page.waitForSelector("text=認証機能を追加する", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("with summary", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prsummarypanel--with-summary&viewMode=story"
    );
    await page.waitForSelector("text=全体要約", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-summary.png"
    );
  });

  test("error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prsummarypanel--error&viewMode=story"
    );
    await page.waitForSelector("text=LLM API connection failed", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });
});
