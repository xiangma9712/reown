import { test, expect } from "@playwright/test";

test.describe("ReviewTab", () => {
  test("no branch", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--no-branch&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "no-branch.png"
    );
  });

  test("main branch", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--main-branch&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "main-branch.png"
    );
  });

  test("empty", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--empty&viewMode=story"
    );
    await page.waitForSelector("text=mainとの差分はありません", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("loading", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--loading&viewMode=story"
    );
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--error&viewMode=story"
    );
    await page.waitForSelector("text=Reference", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("with diffs", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--with-diffs&viewMode=story"
    );
    await page.waitForSelector("text=差分概要", { timeout: 10_000 });
    await page.waitForSelector("text=src/auth.ts", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-diffs.png"
    );
  });

  test("with pr info", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--with-pr-info&viewMode=story"
    );
    await page.waitForSelector("text=PR情報", { timeout: 10_000 });
    await page.waitForSelector("text=8 ファイル変更", { timeout: 10_000 });
    await page.waitForSelector("text=コミット一覧", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-pr-info.png"
    );
  });

  test("pr files loading", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--pr-files-loading&viewMode=story"
    );
    await page.waitForSelector("text=PR情報", { timeout: 10_000 });
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "pr-files-loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("pr files error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--pr-files-error&viewMode=story"
    );
    await page.waitForSelector("text=PR情報", { timeout: 10_000 });
    await page.waitForSelector("text=GitHub API", { timeout: 10_000 });
    await page.waitForSelector("text=コミット一覧", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "pr-files-error.png"
    );
  });

  test("file list collapsed", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--file-list-collapsed&viewMode=story"
    );
    await page.waitForSelector("text=差分概要", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "file-list-collapsed.png"
    );
  });

  test("file list resized", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--file-list-resized&viewMode=story"
    );
    await page.waitForSelector("text=差分概要", { timeout: 10_000 });
    await page.waitForSelector("text=src/auth.ts", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "file-list-resized.png"
    );
  });

  test("navigate to branch", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--navigate-to-branch&viewMode=story"
    );
    await page.waitForSelector("text=差分概要", { timeout: 10_000 });
    await page.waitForSelector("text=src/auth.ts", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "navigate-to-branch.png"
    );
  });

  test("navigate to branch empty", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewtab--navigate-to-branch-empty&viewMode=story"
    );
    await page.waitForSelector("text=mainとの差分はありません", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "navigate-to-branch-empty.png"
    );
  });
});
