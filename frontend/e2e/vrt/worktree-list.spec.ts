import { test, expect } from "@playwright/test";

test.describe("WorktreeList", () => {
  test("with worktrees", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-worktreelist--with-worktrees&viewMode=story"
    );
    await page.waitForSelector("text=feature/auth", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-worktrees.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-worktreelist--empty&viewMode=story"
    );
    await page.waitForSelector("text=ワークツリーがありません", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-worktreelist--loading&viewMode=story"
    );
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-worktreelist--error&viewMode=story"
    );
    await page.waitForSelector("text=Repository not found", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("main only", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-worktreelist--main-only&viewMode=story"
    );
    await page.waitForSelector("text=main", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "main-only.png"
    );
  });
});
