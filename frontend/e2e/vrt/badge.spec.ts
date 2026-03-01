import { test, expect } from "@playwright/test";

test.describe("Badge", () => {
  test("default", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--default&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("success", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--success&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "success.png"
    );
  });

  test("warning", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--warning&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "warning.png"
    );
  });

  test("danger", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--danger&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "danger.png"
    );
  });

  test("info", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--info&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot("info.png");
  });

  test("accent", async ({ page }) => {
    await page.goto("/iframe.html?id=components-badge--accent&viewMode=story");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "accent.png"
    );
  });

  test("with-aria-label", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--with-aria-label&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-aria-label.png"
    );
  });

  test("status-badge", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-badge--status-badge&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "status-badge.png"
    );
  });
});
