import { test, expect } from "@playwright/test";

test.describe("TextArea", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-textarea--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with label", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-textarea--with-label&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-label.png"
    );
  });

  test("with error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-textarea--with-error&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-error.png"
    );
  });

  test("disabled", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-textarea--disabled&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "disabled.png"
    );
  });
});
