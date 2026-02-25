import type { Meta, StoryObj } from "@storybook/react-vite";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";
import { AutomationSettingsTab } from "./AutomationSettingsTab";

const meta = {
  title: "Components/AutomationSettingsTab",
  component: AutomationSettingsTab,
  beforeEach: () => {
    resetInvokeOverrides();
  },
} satisfies Meta<typeof AutomationSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト状態: 自動化無効 */
export const Default: Story = {};

/** 有効化状態: リスクレベル選択表示 */
export const Enabled: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: true,
          auto_approve_max_risk: "Low" as const,
          enable_auto_merge: false,
          auto_merge_method: "Squash" as const,
        }),
      });
      return <Story />;
    },
  ],
};

/** 全オプション有効: 自動マージも含む */
export const FullyEnabled: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: true,
          auto_approve_max_risk: "Medium" as const,
          enable_auto_merge: true,
          auto_merge_method: "Squash" as const,
        }),
      });
      return <Story />;
    },
  ],
};

/** 保存エラー状態 */
export const SaveError: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        save_automation_config: () => {
          throw new Error("設定の保存に失敗しました");
        },
      });
      return <Story />;
    },
  ],
};

/** 読み込みエラー状態 */
export const LoadError: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => {
          throw new Error("設定の読み込みに失敗しました");
        },
      });
      return <Story />;
    },
  ],
};
