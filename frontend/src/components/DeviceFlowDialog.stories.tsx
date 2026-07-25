import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeviceFlowDialog } from "./DeviceFlowDialog";
import {
  overrideInvoke,
  resetInvokeOverrides,
} from "../storybook";

const mockFlow = {
  device_code: "mock_device_code_123",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  interval: 5,
  expires_in: 900,
};

const meta = {
  title: "Components/DeviceFlowDialog",
  component: DeviceFlowDialog,
  args: {
    open: true,
    onClose: () => {},
    onAuthenticated: () => {},
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof DeviceFlowDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 初期化・ローディング中 */
export const Initializing: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        start_github_device_flow: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
};

/** ポーリング中（ユーザーコード表示） */
export const Polling: Story = {
  args: {
    initialDeviceFlow: mockFlow,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        poll_github_device_flow: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
};

/** 認証成功状態 */
export const Success: Story = {
  args: {
    initialDeviceFlow: mockFlow,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        poll_github_device_flow: () => Promise.resolve(),
      });
      return <Story />;
    },
  ],
};

/** 認証エラー状態 */
export const ErrorState: Story = {
  args: {
    initialDeviceFlow: mockFlow,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        poll_github_device_flow: () =>
          Promise.reject("デバイスコードの有効期限が切れました。再度認証を開始してください。"),
      });
      return <Story />;
    },
  ],
};
