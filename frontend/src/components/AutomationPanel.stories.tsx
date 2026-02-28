import type { Meta, StoryObj } from "@storybook/react-vite";
import { AutomationPanel } from "./AutomationPanel";
import { overrideInvoke, resetInvokeOverrides, fixtures } from "../storybook";

const meta = {
  title: "Components/AutomationPanel",
  component: AutomationPanel,
  args: {
    owner: "example",
    repo: "reown",
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof AutomationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（アイドル状態） */
export const Default: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...fixtures.automationConfig,
          enabled: true,
        }),
        evaluate_auto_approve_candidates: () => fixtures.autoApproveCandidates,
      });
      return <Story />;
    },
  ],
};

/** 候補なし */
export const NoCandidates: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...fixtures.automationConfig,
          enabled: true,
        }),
        evaluate_auto_approve_candidates: () => [],
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("自動Approve実行");
    button.click();
  },
};

/** 候補一覧（確認ダイアログ表示） */
export const WithCandidates: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...fixtures.automationConfig,
          enabled: true,
        }),
        evaluate_auto_approve_candidates: () => fixtures.autoApproveCandidates,
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("自動Approve実行");
    button.click();
  },
};

/** 実行結果（成功） */
export const ResultSuccess: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...fixtures.automationConfig,
          enabled: true,
          enable_auto_merge: true,
        }),
        evaluate_auto_approve_candidates: () => fixtures.autoApproveCandidates,
        run_auto_approve_with_merge: () => fixtures.autoApproveWithMergeResult,
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    // Click evaluate
    const button = canvas.getByText("自動Approve実行");
    button.click();
  },
};

/** 実行結果（一部失敗） */
export const ResultMixed: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...fixtures.automationConfig,
          enabled: true,
          enable_auto_merge: true,
        }),
        evaluate_auto_approve_candidates: () => fixtures.autoApproveCandidates,
        run_auto_approve_with_merge: () =>
          fixtures.autoApproveWithMergeResultMixed,
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("自動Approve実行");
    button.click();
  },
};
