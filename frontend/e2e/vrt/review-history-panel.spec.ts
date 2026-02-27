import { test, expect } from "@playwright/test";

test.describe("ReviewHistoryPanel", () => {
  test("with records", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewhistorypanel--with-records&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "with-records.png"
    );
  });

  test("empty", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=components-reviewhistorypanel--empty&viewMode=story"
    );
    await expect(page.locator("#storybook-root")).toHaveScreenshot("empty.png");
  });
});
