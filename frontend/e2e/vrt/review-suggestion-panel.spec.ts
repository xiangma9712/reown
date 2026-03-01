import { test, expect } from "@playwright/test";

test.describe("ReviewSuggestionPanel", () => {
  test("default idle state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--loading&viewMode=story"
    );
    // play関数の実行を待つ
    await page.waitForSelector("text=サジェスト生成中…", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--error&viewMode=story"
    );
    // play関数のエラー表示を待つ
    await page.waitForSelector("text=LLM API connection failed", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("with suggestions", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--with-suggestions&viewMode=story"
    );
    // play関数の結果表示を待つ
    await page.waitForSelector("text=認証トークンの有効期限チェック", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-suggestions.png"
    );
  });

  test("with insert comment button", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--with-insert-comment&viewMode=story"
    );
    // play関数の結果表示を待つ
    await page.waitForSelector("text=認証トークンの有効期限チェック", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-insert-comment.png"
    );
  });

  test("empty suggestions", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsuggestionpanel--empty&viewMode=story"
    );
    // play関数の結果表示を待つ
    await page.waitForSelector("text=サジェストはありません", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });
});
