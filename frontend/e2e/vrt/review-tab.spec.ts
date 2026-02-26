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
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-pr-info.png"
    );
  });
});
