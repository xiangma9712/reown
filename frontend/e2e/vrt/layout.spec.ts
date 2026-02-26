import { test, expect } from "@playwright/test";

test.describe("Layout", () => {
  test("with repository selected", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-layout--with-repo&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-repo.png"
    );
  });

  test("no repository selected", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-layout--no-repo-selected&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "no-repo-selected.png"
    );
  });

  test("with branch selector", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-layout--with-branch-selector&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-branch-selector.png"
    );
  });

  test("focus-visible on interactive elements", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-layout--with-repo&viewMode=story"
    );
    await page.keyboard.press("Tab");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "focus-visible.png"
    );
  });

  test("mobile with repo selected", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(
      "/iframe.html?id=components-layout--mobile-with-repo&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "mobile-with-repo.png"
    );
  });

  test("mobile no repo selected", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(
      "/iframe.html?id=components-layout--mobile-no-repo&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "mobile-no-repo.png"
    );
  });
});
