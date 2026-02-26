import { test, expect } from "@playwright/test";

test.describe("ConfirmDialog", () => {
  test("destructive", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-confirmdialog--destructive&viewMode=story"
    );
    // Portalでbodyにレンダリングされるためフルページをキャプチャ
    await page.waitForSelector("text=このリポジトリを削除しますか", {
      timeout: 10_000,
    });
    await expect(page).toHaveScreenshot("destructive.png");
  });

  test("primary", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-confirmdialog--primary&viewMode=story"
    );
    await page.waitForSelector("text=この操作を実行しますか", {
      timeout: 10_000,
    });
    await expect(page).toHaveScreenshot("primary.png");
  });

  test("with children", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-confirmdialog--with-children&viewMode=story"
    );
    await page.waitForSelector("text=自動Approve", {
      timeout: 10_000,
    });
    await expect(page).toHaveScreenshot("with-children.png");
  });
});
