import { test, expect } from "@playwright/test";

test.describe("Sidebar", () => {
  test("default with repositories", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png"
    );
  });

  test("empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });

  test("selected repository", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--selected&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "selected.png"
    );
  });

  test("settings open", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--settings-open&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "settings-open.png"
    );
  });

  test("focus-visible on interactive elements", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--default&viewMode=story"
    );
    await page.keyboard.press("Tab");
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "focus-visible.png"
    );
  });
});
