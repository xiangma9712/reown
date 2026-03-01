import { test, expect } from "@playwright/test";

test.describe("SetupWizardStep4", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-setupwizardstep4--default&viewMode=story"
    );
    await page.waitForSelector("text=セットアップ完了", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });
});
