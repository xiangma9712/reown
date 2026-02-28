import { test, expect } from "@playwright/test";

test.describe("Button", () => {
  test("primary variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--primary&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "primary.png"
    );
  });

  test("secondary variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--secondary&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "secondary.png"
    );
  });

  test("destructive variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--destructive&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "destructive.png"
    );
  });

  test("ghost variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--ghost&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "ghost.png"
    );
  });

  test("disabled state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--disabled&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "disabled.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--loading&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("filter variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--filter&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter.png"
    );
  });

  test("filter active variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--filter-active&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter-active.png"
    );
  });

  test("tab variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--tab&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "tab.png"
    );
  });

  test("tab active variant", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-button--tab-active&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "tab-active.png"
    );
  });
});
