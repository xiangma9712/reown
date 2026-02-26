import { test, expect } from "@playwright/test";

test.describe("ChangeSummaryList", () => {
  test("initial state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--initial&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "initial.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--loading&viewMode=story"
    );
    // play関数のストリーミングテキスト表示を待つ
    await page.waitForSelector("text=認証機能を追加する", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.03 }
    );
  });

  test("with summary", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--with-summary&viewMode=story"
    );
    // play関数のサマリー表示を待つ
    await page.waitForSelector("text=全体要約", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-summary.png"
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--error&viewMode=story"
    );
    // play関数のエラー表示を待つ
    await page.waitForSelector("text=LLM API connection failed", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "error.png"
    );
  });

  test("diff expanded", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-changesummarylist--diff-expanded&viewMode=story"
    );
    // play関数のdiff展開を待つ
    await page.waitForSelector("text=@@ -10,6 +10,12 @@", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "diff-expanded.png"
    );
  });
});
