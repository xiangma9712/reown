import { test, expect } from "@playwright/test";

test.describe("AutomationSettingsTab", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--default&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("enabled state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled.png"
    );
  });

  test("fully enabled state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--fully-enabled&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "fully-enabled.png"
    );
  });

  test("save error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--save-error&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "save-error.png"
    );
  });

  test("load error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--load-error&viewMode=story"
    );
    await page.locator("#storybook-root").waitFor();
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "load-error.png"
    );
  });
});
