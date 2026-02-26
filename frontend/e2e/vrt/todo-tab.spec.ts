import { test, expect } from "@playwright/test";

test.describe("TodoTab", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with items", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--with-items&viewMode=story"
    );
    await page.locator("text=src/auth.ts").waitFor({ timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-items.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--empty&viewMode=story"
    );
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "empty.png"
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--error&viewMode=story"
    );
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "error.png"
    );
  });

  test("filter todo", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--filter-todo&viewMode=story"
    );
    await page.locator("text=src/auth.ts").waitFor({ timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter-todo.png"
    );
  });

  test("filter fixme", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--filter-fixme&viewMode=story"
    );
    await page.locator("text=src/legacy/old-auth.ts").waitFor({ timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter-fixme.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-todotab--loading&viewMode=story"
    );
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.03 }
    );
  });
});
