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

  test("long repo name with tooltip", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--long-repo-name&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "long-repo-name.png"
    );
  });

  test("with close button", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--with-close-button&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-close-button.png"
    );
  });

  test("tooltip shows full path on hover", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--long-repo-name&viewMode=story"
    );
    const repoButton = page.getByText(
      "my-very-long-repository-name-that-exceeds-sidebar-width"
    );
    await repoButton.hover();
    await page.waitForSelector('[data-radix-popper-content-wrapper]');
    await expect(page).toHaveScreenshot("tooltip-visible.png");
  });

  test("collapsed state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed.png"
    );
  });

  test("expanded with toggle button", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed-with-toggle&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "expanded-with-toggle.png"
    );
  });

  test("loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--loading&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("collapsed loading state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed-loading&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed-loading.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("collapsed adding state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed-adding&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed-adding.png",
      { maxDiffPixelRatio: 0.08 }
    );
  });

  test("collapsed empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed-empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed-empty.png"
    );
  });

  test("collapsed settings open", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--collapsed-settings-open&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "collapsed-settings-open.png"
    );
  });

  // ── Theme toggle ───────────────────────────────────────────

  test("theme toggle light", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--theme-toggle-light&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "theme-toggle-light.png"
    );
  });

  test("theme toggle dark", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--theme-toggle-dark&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "theme-toggle-dark.png"
    );
  });

  // ── Dark mode ──────────────────────────────────────────────

  test("dark: default with repositories", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--dark-default&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "dark-default.png"
    );
  });

  test("dark: selected repository", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--dark-selected&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "dark-selected.png"
    );
  });

  test("dark: empty state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--dark-empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "dark-empty.png"
    );
  });

  test("dark: collapsed state", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--dark-collapsed&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "dark-collapsed.png"
    );
  });

  test("dark: settings open", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-sidebar--dark-settings-open&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "dark-settings-open.png"
    );
  });
});
