import { test, expect } from "@playwright/test";

test.describe("RerunWizardSection", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-rerunwizardsection--default&viewMode=story"
    );
    await page.waitForSelector("text=セットアップウィザード", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });
});
