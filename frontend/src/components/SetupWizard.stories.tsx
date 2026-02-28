import type { Meta, StoryObj } from "@storybook/react-vite";
import { SetupWizard } from "./SetupWizard";

const meta = {
  title: "Components/SetupWizard",
  component: SetupWizard,
} satisfies Meta<typeof SetupWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示（リポジトリ選択ステップ） */
export const Default: Story = {
  args: {
    onComplete: () => {},
  },
};
