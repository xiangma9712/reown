import { test, expect } from "@playwright/test";

test.describe("PrListView", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("filter state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--filter&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--loading&viewMode=story"
    );
    // ローディングスピナーのアニメーションがあるため閾値を緩和
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.03 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--error&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("with risk badge", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--with-risk-badge&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-risk-badge.png"
    );
  });
});
