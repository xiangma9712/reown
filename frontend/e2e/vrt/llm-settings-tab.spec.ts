import { test, expect } from "@playwright/test";

test.describe("LlmSettingsTab", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--default&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--empty&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("filled state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--filled&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filled.png"
    );
  });

  test("save error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--save-error&viewMode=story"
    );
    await page.locator("#storybook-root button").first().waitFor();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "save-error.png"
    );
  });

  test("load error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--load-error&viewMode=story"
    );
    // Load error shows error message, wait for it
    await page.locator("#storybook-root").waitFor();
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "load-error.png"
    );
  });
});
