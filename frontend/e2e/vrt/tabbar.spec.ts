import { test, expect } from "@playwright/test";

test.describe("TabBar", () => {
  test("first active", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-tabbar--first-active&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "first-active.png"
    );
  });

  test("second active", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-tabbar--second-active&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "second-active.png"
    );
  });

  test("third active", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-tabbar--third-active&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "third-active.png"
    );
  });

  test("focus-visible on tab", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-tabbar--first-active&viewMode=story"
    );
    await page.keyboard.press("Tab");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "focus-visible.png"
    );
  });
});
