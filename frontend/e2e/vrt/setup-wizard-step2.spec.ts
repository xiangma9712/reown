import { test, expect } from "@playwright/test";

test.describe("SetupWizardStep2", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-setupwizardstep2--default&viewMode=story"
    );
    await page.waitForSelector("text=GitHub認証", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });
});
