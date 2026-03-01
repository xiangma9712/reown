import { test, expect } from "@playwright/test";

test.describe("SetupWizardStep1", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-setupwizardstep1--default&viewMode=story"
    );
    await page.waitForSelector("text=リポジトリ選択", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });
});
