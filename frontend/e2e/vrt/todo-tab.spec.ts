import { test, expect } from "@playwright/test";

test.describe("TodoTab", () => {
  test("initial state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--initial&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "initial.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--loading&viewMode=story"
    );
    // play関数の実行を待つ
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("with items", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--with-items&viewMode=story"
    );
    // play関数のアイテム表示を待つ
    await page.waitForSelector("text=リフレッシュトークンの実装", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-items.png"
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--error&viewMode=story"
    );
    // play関数のエラー表示を待つ
    await page.waitForSelector("text=Repository not found", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("filtered todo", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--filtered-todo&viewMode=story"
    );
    // play関数のフィルター適用を待つ
    await page.waitForSelector("text=リフレッシュトークンの実装", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filtered-todo.png"
    );
  });

  test("filtered fixme", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--filtered-fixme&viewMode=story"
    );
    // play関数のフィルター適用を待つ
    await page.waitForSelector("text=このファイルは削除予定", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filtered-fixme.png"
    );
  });
});
