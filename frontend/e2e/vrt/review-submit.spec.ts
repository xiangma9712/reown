import { test, expect } from "@playwright/test";

test.describe("ReviewSubmit", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsubmit--default&viewMode=story"
    );
    await page.waitForSelector("text=#42", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("no analysis", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewsubmit--no-analysis&viewMode=story"
    );
    await page.waitForSelector("text=#42", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "no-analysis.png"
    );
  });
});
