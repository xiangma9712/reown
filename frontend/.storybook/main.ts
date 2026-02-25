import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
  ],
  framework: "@storybook/react-vite",
  viteFinal(config) {
    config.plugins = config.plugins ?? [];
    config.plugins.push(tailwindcss());

    // Tauri API をモックシムに差し替え
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "../src/storybook/shims/tauri-core.ts"
      ),
      "@tauri-apps/api/event": path.resolve(
        __dirname,
        "../src/storybook/shims/tauri-event.ts"
      ),
      "@tauri-apps/plugin-dialog": path.resolve(
        __dirname,
        "../src/storybook/shims/tauri-dialog.ts"
      ),
    };

    return config;
  },
};
export default config;
