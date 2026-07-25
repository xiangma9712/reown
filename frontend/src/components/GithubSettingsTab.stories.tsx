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

/** Device Flow ダイアログ表示中 */
export const DeviceFlowDialogOpen: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        get_github_auth_status: () => false,
        start_github_device_flow: () =>
          Promise.resolve({
            device_code: "mock-code",
            user_code: "ABCD-1234",
            verification_uri: "https://github.com/login/device",
            interval: 5,
            expires_in: 900,
          }),
        poll_github_device_flow: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const loginButton = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="github-login-button"]'
    );
    if (loginButton) {
      loginButton.click();
    }
  },
};
