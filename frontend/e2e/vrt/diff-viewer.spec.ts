import { test, expect } from "@playwright/test";

test.describe("DiffViewer", () => {
  test("modified file", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-diffviewer--modified&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "modified.png"
    );
  });

  test("added file", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-diffviewer--added&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "added.png"
    );
  });

  test("deleted file", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-diffviewer--deleted&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "deleted.png"
    );
  });

  test("multiple chunks", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-diffviewer--multiple-chunks&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "multiple-chunks.png"
    );
  });

  test("renamed file", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-diffviewer--renamed&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "renamed.png"
    );
  });
});
