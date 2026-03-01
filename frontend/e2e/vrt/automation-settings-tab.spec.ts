import { test, expect } from "@playwright/test";

test.describe("AutomationSettingsTab", () => {
  test("default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--default&viewMode=story"
    );
    await page.waitForSelector("text=オートメーション設定", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("enabled", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled&viewMode=story"
    );
    await page.waitForSelector("text=リスクカスタマイズ", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled.png"
    );
  });

  test("enabled with auto merge", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled-with-auto-merge&viewMode=story"
    );
    await page.waitForSelector("text=マージ方法", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled-with-auto-merge.png"
    );
  });

  test("enabled with sensitive patterns", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--enabled-with-sensitive-patterns&viewMode=story"
    );
    await page.waitForSelector("text=センシティブパスパターン", {
      timeout: 10_000,
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "enabled-with-sensitive-patterns.png"
    );
  });

  test("slider interaction", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--slider-interaction&viewMode=story"
    );
    await page.waitForSelector("text=2.5", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "slider-interaction.png"
    );
  });

  test("threshold input", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--threshold-input&viewMode=story"
    );
    await page.waitForSelector("text=0 ~ 30", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "threshold-input.png"
    );
  });

  test("missing test penalty interaction", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--missing-test-penalty-interaction&viewMode=story"
    );
    await page.waitForSelector("text=テスト未追加ペナルティ", {
      timeout: 10_000,
    });
    // Wait for story play interaction to update the input value to 35
    await expect(
      page.locator('#storybook-root input[type="number"][min="0"][max="50"]')
    ).toHaveValue("35", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "missing-test-penalty-interaction.png"
    );
  });

  test("add sensitive pattern", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--add-sensitive-pattern&viewMode=story"
    );
    await page.waitForSelector("text=secret", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "add-sensitive-pattern.png"
    );
  });

  test("remove sensitive pattern", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-automationsettingstab--remove-sensitive-pattern&viewMode=story"
    );
    await page.waitForSelector("text=security", { timeout: 10_000 });
    // Wait for "auth" pattern to be removed by the story play interaction
    await expect(
      page.locator('#storybook-root [aria-label="削除 auth"]')
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "remove-sensitive-pattern.png"
    );
  });
});
