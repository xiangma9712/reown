import type { Meta, StoryObj } from "@storybook/react-vite";
import { AutomationSettingsTab } from "./AutomationSettingsTab";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";

const meta = {
  title: "Components/AutomationSettingsTab",
  component: AutomationSettingsTab,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof AutomationSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（無効状態） */
export const Default: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: false,
          auto_approve_max_risk: "Low" as const,
          enable_auto_merge: false,
          auto_merge_method: "Squash" as const,
        }),
      });
      return <Story />;
    },
  ],
};

/** 有効状態（Auto Merge無効） */
export const Enabled: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: true,
          auto_approve_max_risk: "Medium" as const,
          enable_auto_merge: false,
          auto_merge_method: "Squash" as const,
        }),
      });
      return <Story />;
    },
  ],
};

/** 有効状態（Auto Merge有効） */
export const EnabledWithAutoMerge: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: true,
          auto_approve_max_risk: "Low" as const,
          enable_auto_merge: true,
          auto_merge_method: "Squash" as const,
        }),
      });
      return <Story />;
    },
  ],
};
