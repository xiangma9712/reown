import { test, expect } from "@playwright/test";

test.describe("Input", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-input--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with label", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-input--with-label&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-label.png"
    );
  });

  test("with error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-input--with-error&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-error.png"
    );
  });

  test("disabled", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-input--disabled&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "disabled.png"
    );
  });
});
