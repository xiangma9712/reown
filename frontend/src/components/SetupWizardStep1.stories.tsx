import type { Meta, StoryObj } from "@storybook/react-vite";
import { SetupWizardStep1 } from "./SetupWizardStep1";

const meta = {
  title: "Components/SetupWizardStep1",
  component: SetupWizardStep1,
} satisfies Meta<typeof SetupWizardStep1>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示（リポジトリ選択プレースホルダー） */
export const Default: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
};
