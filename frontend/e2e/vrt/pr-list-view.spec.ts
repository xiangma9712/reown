import { test, expect } from "@playwright/test";

test.describe("PrListView", () => {
  test("default state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("filter state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--filter&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "filter.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--loading&viewMode=story"
    );
    // ローディングスピナーのアニメーションがあるため閾値を緩和
    await page.waitForSelector('[role="status"]', { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("error state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--error&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("error.png");
  });

  test("with risk badge", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--with-risk-badge&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-risk-badge.png"
    );
  });

  test("with expanded commits", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--with-expanded-commits&viewMode=story"
    );
    // PR行をクリックしてコミット一覧を展開
    await page.locator("text=#42").click();
    await page.waitForSelector("text=abc1234", { timeout: 10_000 });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-expanded-commits.png"
    );
  });

  test("with expanded commits error", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-prlistview--with-expanded-commits-error&viewMode=story"
    );
    // PR行をクリックしてエラー状態を表示
    await page.locator("text=#42").click();
    await page.waitForTimeout(500);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-expanded-commits-error.png"
    );
  });
});
