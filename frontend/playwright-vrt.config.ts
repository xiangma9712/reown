import { defineConfig } from "@playwright/test";

/**
 * Storybook Visual Regression Test 設定。
 *
 * 使い方:
 *   1. npm run storybook (別ターミナルで起動)
 *   2. npm run test:vrt
 *
 * スナップショット更新:
 *   npm run test:vrt -- --update-snapshots
 */
export default defineConfig({
  testDir: "./e2e/vrt",
  outputDir: "./e2e/vrt/test-results",
  snapshotDir: "./e2e/vrt/__snapshots__",
  snapshotPathTemplate:
    "{snapshotDir}/{testFilePath}/{testName}/{projectName}{ext}",
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: "http://localhost:6006",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: "npm run storybook -- --ci",
    url: "http://localhost:6006",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
