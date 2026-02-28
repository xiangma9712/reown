import { test, expect } from "@playwright/test";

test.describe("OnboardingPlaceholder", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-onboardingplaceholder--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });
});
