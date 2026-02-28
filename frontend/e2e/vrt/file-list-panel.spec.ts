import { test, expect } from "@playwright/test";

test.describe("FileListPanel", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filelistpanel--default&viewMode=story"
    );
    await page.waitForSelector("text=Changed Files", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filelistpanel--loading&viewMode=story"
    );
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filelistpanel--error&viewMode=story"
    );
    await page.waitForSelector("text=Reference", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filelistpanel--empty&viewMode=story"
    );
    await page.waitForSelector("text=No changed files", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("collapsed state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-filelistpanel--collapsed&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed.png"
    );
  });
});
