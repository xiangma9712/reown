import type { Meta, StoryObj } from "@storybook/react-vite";
import { SetupWizardStep3 } from "./SetupWizardStep3";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";
import { fixtures } from "../storybook/fixtures";

const meta = {
  title: "Components/SetupWizardStep3",
  component: SetupWizardStep3,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof SetupWizardStep3>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示（初回起動、既存設定なし） */
export const Default: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => {
          throw new Error("No config");
        },
      });
      return <Story />;
    },
  ],
};

/** 既存設定がある場合（オンボーディング再実行） */
export const WithExistingConfig: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        load_llm_config: () => fixtures.llmConfig,
      });
      return <Story />;
    },
  ],
};

/** 接続テスト成功後 */
export const AfterTestSuccess: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        test_llm_connection: () => undefined as never,
      });
      return <Story />;
    },
  ],
};

/** 接続テスト失敗 */
export const AfterTestError: Story = {
  args: {
    onNext: () => {},
    onSkip: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        test_llm_connection: () => {
          throw new Error("Invalid API key");
        },
      });
      return <Story />;
    },
  ],
};
