import { test, expect } from "@playwright/test";

test.describe("CommitListPanel", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-commitlistpanel--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-commitlistpanel--loading&viewMode=story"
    );
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-commitlistpanel--error&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-commitlistpanel--empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("empty commit url fallback", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-commitlistpanel--empty-commit-url&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "empty-commit-url.png"
    );
  });
});
