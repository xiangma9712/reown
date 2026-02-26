import { test, expect } from "@playwright/test";

test.describe("Badge", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("success", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--success&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "success.png"
    );
  });

  test("warning", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--warning&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "warning.png"
    );
  });

  test("danger", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--danger&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "danger.png"
    );
  });

  test("info", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--info&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("info.png");
  });

  test("purple", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--purple&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "purple.png"
    );
  });
});
