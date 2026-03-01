import { test, expect } from "@playwright/test";

test.describe("WarningBanner", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-warningbanner--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("long message", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-warningbanner--long-message&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "long-message.png"
    );
  });
});
