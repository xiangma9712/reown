import { test, expect } from "@playwright/test";

test.describe("LlmSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--default&viewMode=story"
    );
    // 設定の読み込みを待つ
    await page.waitForSelector("text=LLM設定", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("with api key stored", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--with-api-key-stored&viewMode=story"
    );
    await page.waitForSelector("text=APIキーは安全に保存されています", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-api-key-stored.png"
    );
  });

  test("test success", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--test-success&viewMode=story"
    );
    await page.waitForSelector("text=LLM設定", { timeout: 10_000 });
    // 接続テストボタンをクリック
    await page.getByRole("button", { name: "接続テスト" }).click();
    // 成功メッセージを待つ
    await page.waitForSelector("text=接続テストに成功しました", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "test-success.png"
    );
  });

  test("test error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-llmsettingstab--test-error&viewMode=story"
    );
    await page.waitForSelector("text=LLM設定", { timeout: 10_000 });
    // 接続テストボタンをクリック
    await page.getByRole("button", { name: "接続テスト" }).click();
    // エラーメッセージを待つ
    await page.waitForSelector("text=接続テストに失敗しました", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "test-error.png"
    );
  });
});
