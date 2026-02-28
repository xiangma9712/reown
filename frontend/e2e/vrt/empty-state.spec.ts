import { test, expect } from "@playwright/test";

test.describe("EmptyState", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-emptystate--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with description", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-emptystate--with-description&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-description.png"
    );
  });

  test("with icon", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-emptystate--with-icon&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-icon.png"
    );
  });

  test("with cta", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-emptystate--with-cta&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-cta.png"
    );
  });
});
