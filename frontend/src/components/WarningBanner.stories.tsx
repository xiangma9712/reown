import type { Meta, StoryObj } from "@storybook/react-vite";
import { WarningBanner } from "./WarningBanner";

const meta = {
  title: "Components/WarningBanner",
  component: WarningBanner,
} satisfies Meta<typeof WarningBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト */
export const Default: Story = {
  args: { message: "データベース層の変更が含まれています" },
};

/** 長いメッセージ */
export const LongMessage: Story = {
  args: {
    message:
      "認証・セキュリティ関連のファイルが変更されています。慎重にレビューしてください。",
  },
};
