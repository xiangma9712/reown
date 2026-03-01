import type { Meta, StoryObj } from "@storybook/react-vite";
import { SetupWizardStep4 } from "./SetupWizardStep4";

const meta = {
  title: "Components/SetupWizardStep4",
  component: SetupWizardStep4,
} satisfies Meta<typeof SetupWizardStep4>;

export default meta;
type Story = StoryObj<typeof meta>;

/** セットアップ完了画面 */
export const Default: Story = {
  args: {
    onComplete: () => {},
  },
};
