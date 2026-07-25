import { test, expect } from "@playwright/test";

test.describe("DeviceFlowDialog", () => {
  test("polling state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-deviceflowdialog--polling&viewMode=story"
    );
    await page.waitForSelector("text=WXYZ-9876", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "polling.png"
    );
  });

  test("success state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-deviceflowdialog--success&viewMode=story"
    );
    await page.waitForSelector("text=認証が完了しました！", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "success.png"
    );
  });
});
