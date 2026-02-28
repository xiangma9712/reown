import type { Meta, StoryObj } from "@storybook/react-vite";
import { OnboardingPlaceholder } from "./OnboardingPlaceholder";

const meta = {
  title: "Components/OnboardingPlaceholder",
  component: OnboardingPlaceholder,
} satisfies Meta<typeof OnboardingPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示 */
export const Default: Story = {
  args: {
    onSkip: () => {},
  },
};
