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
          risk_config: {
            category_weights: {},
            sensitive_patterns: [],
            file_count_thresholds: [],
            line_count_thresholds: [],
            missing_test_penalty: 15,
            risk_thresholds: { low_max: 25, medium_max: 55 },
          },
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
          risk_config: {
            category_weights: {},
            sensitive_patterns: [],
            file_count_thresholds: [],
            line_count_thresholds: [],
            missing_test_penalty: 15,
            risk_thresholds: { low_max: 25, medium_max: 55 },
          },
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
          risk_config: {
            category_weights: {},
            sensitive_patterns: [],
            file_count_thresholds: [],
            line_count_thresholds: [],
            missing_test_penalty: 15,
            risk_thresholds: { low_max: 25, medium_max: 55 },
          },
        }),
      });
      return <Story />;
    },
  ],
};
