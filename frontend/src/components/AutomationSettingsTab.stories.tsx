import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within, waitFor, expect } from "storybook/test";
import { AutomationSettingsTab } from "./AutomationSettingsTab";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
} from "../storybook";

const meta = {
  title: "Components/AutomationSettingsTab",
  component: AutomationSettingsTab,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return (
        <MockRepositoryProvider>
          <Story />
        </MockRepositoryProvider>
      );
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
            category_weights: {
              Logic: 1.5,
              Test: 0.5,
              Config: 1.0,
              CI: 0.8,
              Documentation: 0.3,
              Dependency: 1.2,
              Refactor: 0.7,
              Other: 1.0,
            },
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
            category_weights: {
              Logic: 1.5,
              Test: 0.5,
              Config: 1.0,
              CI: 0.8,
              Documentation: 0.3,
              Dependency: 1.2,
              Refactor: 0.7,
              Other: 1.0,
            },
            sensitive_patterns: [],
            file_count_thresholds: [],
            line_count_thresholds: [],
            missing_test_penalty: 15,
            risk_thresholds: { low_max: 30, medium_max: 60 },
          },
        }),
      });
      return <Story />;
    },
  ],
};

/** 有効状態（sensitive patterns設定あり） */
export const EnabledWithSensitivePatterns: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          enabled: true,
          auto_approve_max_risk: "Medium" as const,
          enable_auto_merge: false,
          auto_merge_method: "Squash" as const,
          risk_config: {
            category_weights: {
              Logic: 1.5,
              Test: 0.5,
              Config: 1.0,
              CI: 0.8,
              Documentation: 0.3,
              Dependency: 1.2,
              Refactor: 0.7,
              Other: 1.0,
            },
            sensitive_patterns: [
              { pattern: "auth", score: 25 },
              { pattern: "security", score: 25 },
              { pattern: "migration", score: 20 },
              { pattern: "api/", score: 15 },
              { pattern: "deploy", score: 20 },
            ],
            file_count_thresholds: [],
            line_count_thresholds: [],
            missing_test_penalty: 30,
            risk_thresholds: { low_max: 25, medium_max: 55 },
          },
        }),
      });
      return <Story />;
    },
  ],
};

const enabledConfig = {
  enabled: true,
  auto_approve_max_risk: "Medium" as const,
  enable_auto_merge: false,
  auto_merge_method: "Squash" as const,
  risk_config: {
    category_weights: {
      Logic: 1.5,
      Test: 0.5,
      Config: 1.0,
      CI: 0.8,
      Documentation: 0.3,
      Dependency: 1.2,
      Refactor: 0.7,
      Other: 1.0,
    },
    sensitive_patterns: [],
    file_count_thresholds: [],
    line_count_thresholds: [],
    missing_test_penalty: 15,
    risk_thresholds: { low_max: 25, medium_max: 55 },
  },
};

/** スライダー操作：カテゴリ重みスライダーを変更 */
export const SliderInteraction: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => enabledConfig,
        save_automation_config: () => undefined as never,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      canvas.getByText("カテゴリ別リスク重み");
    });

    // カテゴリ重みスライダーを取得（type="range" の input 要素）
    const sliders = canvasElement.querySelectorAll<HTMLInputElement>(
      'input[type="range"][min="0"][max="3"]'
    );
    expect(sliders.length).toBe(8);

    // 最初のスライダー（Logic）の値を変更
    const logicSlider = sliders[0];
    // nativeInputValueSetter を使って React の state を更新
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!;
    nativeInputValueSetter.call(logicSlider, "2.5");
    logicSlider.dispatchEvent(new Event("input", { bubbles: true }));
    logicSlider.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(() => {
      canvas.getByText("2.5");
    });
  },
};

/** 閾値入力：リスクレベル閾値を変更 */
export const ThresholdInput: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => enabledConfig,
        save_automation_config: () => undefined as never,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      canvas.getByText("リスクレベル閾値");
    });

    // Low上限の number input を取得して値を変更
    const thresholdInputs = canvasElement.querySelectorAll<HTMLInputElement>(
      'input[type="number"]'
    );
    // low_max input（最初の number input）
    const lowMaxInput = Array.from(thresholdInputs).find(
      (input) => input.value === "25"
    );
    expect(lowMaxInput).toBeTruthy();

    await userEvent.clear(lowMaxInput!);
    await userEvent.type(lowMaxInput!, "30");

    await waitFor(() => {
      // Low 範囲表示が更新される
      canvas.getByText(/0 ~ 30/);
    });
  },
};

/** テスト未追加ペナルティスライダーを変更 */
export const MissingTestPenaltyInteraction: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => enabledConfig,
        save_automation_config: () => undefined as never,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      canvas.getByText("テスト未追加ペナルティ");
    });

    // ペナルティの number input を取得（値が15のもの）
    const penaltyInput = canvasElement.querySelector<HTMLInputElement>(
      'input[type="number"][min="0"][max="50"]'
    );
    expect(penaltyInput).toBeTruthy();

    await userEvent.clear(penaltyInput!);
    await userEvent.type(penaltyInput!, "35");

    await waitFor(() => {
      expect(penaltyInput!.value).toBe("35");
    });
  },
};

/** センシティブパターン追加 */
export const AddSensitivePattern: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => enabledConfig,
        save_automation_config: () => undefined as never,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      canvas.getByText("センシティブパスパターン");
    });

    // パターン入力フィールド
    const patternInput = canvas.getByPlaceholderText(
      "パターンを入力（例: auth, migration）"
    );
    await userEvent.type(patternInput, "secret");

    // スコア入力フィールド
    const scoreInput = canvas.getByLabelText("スコア");
    await userEvent.clear(scoreInput);
    await userEvent.type(scoreInput, "20");

    // 追加ボタンをクリック
    const addButton = canvas.getByText("追加");
    await userEvent.click(addButton);

    // パターンがリストに追加されたことを確認
    await waitFor(() => {
      canvas.getByText("secret");
    });

    // 入力フィールドがクリアされたことを確認
    await waitFor(() => {
      expect(patternInput).toHaveValue("");
    });
  },
};

/** センシティブパターン削除 */
export const RemoveSensitivePattern: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_automation_config: () => ({
          ...enabledConfig,
          risk_config: {
            ...enabledConfig.risk_config,
            sensitive_patterns: [
              { pattern: "auth", score: 25 },
              { pattern: "security", score: 20 },
            ],
          },
        }),
        save_automation_config: () => undefined as never,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      canvas.getByText("auth");
    });

    // 「auth」パターンの削除ボタンをクリック
    const removeButton = canvas.getByLabelText("削除 auth");
    await userEvent.click(removeButton);

    // 「auth」パターンが削除されたことを確認
    await waitFor(() => {
      expect(canvas.queryByText("auth")).toBeNull();
    });

    // 「security」パターンは残っていること
    canvas.getByText("security");
  },
};
