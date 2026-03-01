import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within, expect } from "storybook/test";
import { ThemeSettingsTab } from "./ThemeSettingsTab";

const meta = {
  title: "Components/ThemeSettingsTab",
  component: ThemeSettingsTab,
} satisfies Meta<typeof ThemeSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  globals: { theme: "dark" },
};

/** Darkボタンをクリックしてテーマ切り替え後の選択状態を確認 */
export const SwitchToDark: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const darkButton = canvas.getByRole("radio", { name: "Dark" });
    await userEvent.click(darkButton);
    await expect(darkButton).toHaveAttribute("aria-checked", "true");
    const lightButton = canvas.getByRole("radio", { name: "Light" });
    await expect(lightButton).toHaveAttribute("aria-checked", "false");
  },
};

/** Systemボタンをクリックしてテーマ切り替え後の選択状態を確認 */
export const SwitchToSystem: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const systemButton = canvas.getByRole("radio", { name: "System" });
    await userEvent.click(systemButton);
    await expect(systemButton).toHaveAttribute("aria-checked", "true");
    const lightButton = canvas.getByRole("radio", { name: "Light" });
    await expect(lightButton).toHaveAttribute("aria-checked", "false");
  },
};

/** キーボード操作でテーマを順に切り替え */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Light が初期選択状態
    const lightButton = canvas.getByRole("radio", { name: "Light" });
    await expect(lightButton).toHaveAttribute("aria-checked", "true");
    // ArrowRight で Dark へ
    lightButton.focus();
    await userEvent.keyboard("{ArrowRight}");
    const darkButton = canvas.getByRole("radio", { name: "Dark" });
    await expect(darkButton).toHaveAttribute("aria-checked", "true");
    await expect(lightButton).toHaveAttribute("aria-checked", "false");
    // ArrowRight で System へ
    await userEvent.keyboard("{ArrowRight}");
    const systemButton = canvas.getByRole("radio", { name: "System" });
    await expect(systemButton).toHaveAttribute("aria-checked", "true");
    await expect(darkButton).toHaveAttribute("aria-checked", "false");
    // ArrowRight でラップして Light に戻る
    await userEvent.keyboard("{ArrowRight}");
    await expect(lightButton).toHaveAttribute("aria-checked", "true");
    await expect(systemButton).toHaveAttribute("aria-checked", "false");
  },
};
