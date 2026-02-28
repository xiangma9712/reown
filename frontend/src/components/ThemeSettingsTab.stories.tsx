import type { Meta, StoryObj } from "@storybook/react-vite";
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
