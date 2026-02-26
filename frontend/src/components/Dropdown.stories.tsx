import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { Dropdown } from "./Dropdown";
import { Button } from "./Button";

const meta = {
  title: "Components/Dropdown",
  component: Dropdown,
  args: {
    trigger: <Button variant="secondary">メニュー</Button>,
    items: [
      { label: "編集", onSelect: () => {} },
      { label: "複製", onSelect: () => {} },
      { label: "削除", onSelect: () => {}, variant: "danger" as const },
    ],
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じた状態 */
export const Closed: Story = {};

/** 開いた状態 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "メニュー" });
    await userEvent.click(trigger);
  },
};
