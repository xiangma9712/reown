import { test, expect } from "@playwright/test";

test.describe("ConsistencyCheckPanel", () => {
  test("initial state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-consistencycheckpanel--initial&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "initial.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-consistencycheckpanel--loading&viewMode=story"
    );
    // play関数の実行を待つ
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.03 }
    );
  });

  test("consistent result", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-consistencycheckpanel--consistent&viewMode=story"
    );
    // play関数の結果表示を待つ
    await page.waitForSelector("text=PRタイトル・本文と変更内容は一致しています", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "consistent.png"
    );
  });

  test("with warnings", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-consistencycheckpanel--with-warnings&viewMode=story"
    );
    // play関数の結果表示を待つ
    await page.waitForSelector(
      "text=PRタイトル・本文と実際の変更内容に乖離があります",
      { timeout: 10_000 }
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-warnings.png"
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-consistencycheckpanel--error&viewMode=story"
    );
    // play関数のエラー表示を待つ
    await page.waitForSelector("text=API rate limit exceeded", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "error.png"
    );
  });
});
