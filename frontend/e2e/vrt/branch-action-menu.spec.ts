import { test, expect } from "@playwright/test";

test.describe("BranchActionMenu", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-branchactionmenu--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("menu opened", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-branchactionmenu--default&viewMode=story"
    );
    // トリガーボタンをクリックしてメニューを開く
    await page.getByRole("button").click();
    // メニューが表示されるまで待機
    await page.getByRole("menuitem").first().waitFor();
    await expect(page).toHaveScreenshot("menu-opened.png");
  });
});
