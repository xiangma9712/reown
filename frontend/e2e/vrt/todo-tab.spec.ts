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
    await page.goto("/iframe.html?id=components-todotab--error&viewMode=story");
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

  test("grouped modules", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--grouped-modules&viewMode=story"
    );
    // play関数のグループ表示を待つ
    await page.waitForSelector("text=lib/git", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "grouped-modules.png"
    );
  });

  test("collapsed groups", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--collapsed-groups&viewMode=story"
    );
    // play関数のグループ表示を待つ
    await page.waitForSelector("text=lib/git", {
      timeout: 10_000,
    });
    // 折りたたみアニメーション完了を待つ
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed-groups.png"
    );
  });

  test("with navigate to branch", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--with-navigate-to-branch&viewMode=story"
    );
    // play関数のworktree表示を待つ
    await page.waitForSelector("text=feature/auth", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-navigate-to-branch.png"
    );
  });
});
