import type { Meta, StoryObj } from "@storybook/react-vite";
import { SetupWizardStep2 } from "./SetupWizardStep2";

const meta = {
  title: "Components/SetupWizardStep2",
  component: SetupWizardStep2,
} satisfies Meta<typeof SetupWizardStep2>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示（GitHub認証の初期状態） */
export const Default: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
};
