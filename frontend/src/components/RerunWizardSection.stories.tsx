import type { Meta, StoryObj } from "@storybook/react-vite";
import { RerunWizardSection } from "./RerunWizardSection";

const meta = {
  title: "Components/RerunWizardSection",
  component: RerunWizardSection,
  args: {
    onRerun: () => {},
  },
} satisfies Meta<typeof RerunWizardSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
