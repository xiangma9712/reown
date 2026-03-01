import { test, expect } from "@playwright/test";

test.describe("SetupWizardStep3", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-setupwizardstep3--default&viewMode=story"
    );
    await page.waitForSelector("text=LLM設定", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with-existing-config", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-setupwizardstep3--with-existing-config&viewMode=story"
    );
    await page.waitForSelector("text=LLM設定", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-existing-config.png"
    );
  });
});
