import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within, expect } from "storybook/test";
import { KeyboardShortcutSettingsTab } from "./KeyboardShortcutSettingsTab";

const meta = {
  title: "Components/KeyboardShortcutSettingsTab",
  component: KeyboardShortcutSettingsTab,
  args: {
    enabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof KeyboardShortcutSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（非表示状態） */
export const Default: Story = {};

/** 表示状態 */
export const Enabled: Story = {
  args: {
    enabled: true,
  },
};

/** ダークテーマ */
export const Dark: Story = {
  globals: { theme: "dark" },
};

/** 「表示する」ボタンをクリックしてonChangeが呼ばれることを確認 */
export const ClickShow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const showButton = canvas.getByRole("radio", { name: "表示する" });
    await userEvent.click(showButton);
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

/** 「非表示」ボタンをクリックしてonChangeが呼ばれることを確認 */
export const ClickHide: Story = {
  args: {
    enabled: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hideButton = canvas.getByRole("radio", { name: "非表示" });
    await userEvent.click(hideButton);
    await expect(args.onChange).toHaveBeenCalledWith(false);
  },
};
