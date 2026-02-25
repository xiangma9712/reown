import type { Meta, StoryObj } from "@storybook/react-vite";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";
import { LlmSettingsTab } from "./LlmSettingsTab";

const meta = {
  title: "Components/LlmSettingsTab",
  component: LlmSettingsTab,
  beforeEach: () => {
    resetInvokeOverrides();
  },
} satisfies Meta<typeof LlmSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト状態: APIキーが保存済み */
export const Default: Story = {};

/** 未設定状態: 全フィールドが空 */
export const Empty: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => ({
          llm_endpoint: "",
          llm_model: "",
          llm_api_key_stored: false,
        }),
      });
      return <Story />;
    },
  ],
};

/** 入力済み状態: APIキー未保存 */
export const Filled: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => ({
          llm_endpoint: "https://api.anthropic.com",
          llm_model: "claude-sonnet-4-5-20250929",
          llm_api_key_stored: false,
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
        save_llm_config: () => {
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
        load_llm_config: () => {
          throw new Error("設定の読み込みに失敗しました");
        },
      });
      return <Story />;
    },
  ],
};
