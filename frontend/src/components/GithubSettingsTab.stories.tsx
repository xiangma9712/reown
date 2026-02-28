import type { Meta, StoryObj } from "@storybook/react-vite";
import { GithubSettingsTab } from "./GithubSettingsTab";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";

const meta = {
  title: "Components/GithubSettingsTab",
  component: GithubSettingsTab,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof GithubSettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（トークン未設定） */
export const Default: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        get_github_auth_status: () => false,
      });
      return <Story />;
    },
  ],
};

/** トークン保存済み */
export const WithTokenStored: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        get_github_auth_status: () => true,
      });
      return <Story />;
    },
  ],
};
