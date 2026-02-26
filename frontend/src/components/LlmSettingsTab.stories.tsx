import type { Meta, StoryObj } from "@storybook/react-vite";
import { LlmSettingsTab } from "./LlmSettingsTab";
import { overrideInvoke, resetInvokeOverrides, fixtures } from "../storybook";

const meta = {
  title: "Components/LlmSettingsTab",
  component: LlmSettingsTab,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof LlmSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（設定読み込み済み） */
export const Default: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => ({
          ...fixtures.llmConfig,
          llm_api_key_stored: false,
        }),
      });
      return <Story />;
    },
  ],
};

/** APIキー保存済み */
export const WithApiKeyStored: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => fixtures.llmConfig,
      });
      return <Story />;
    },
  ],
};
