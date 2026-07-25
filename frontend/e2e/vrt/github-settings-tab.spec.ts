import { test, expect } from "@playwright/test";

test.describe("GithubSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-githubsettingstab--default&viewMode=story"
    );
    await page.waitForSelector("text=GitHub設定", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with token stored", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-githubsettingstab--with-token-stored&viewMode=story"
    );
    await page.waitForSelector("text=GitHub にログイン済み", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-token-stored.png"
    );
  });

  test("device flow dialog open", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-githubsettingstab--device-flow-dialog-open&viewMode=story"
    );
    await page.waitForSelector("text=ABCD-1234", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "device-flow-dialog-open.png"
    );
  });
});
