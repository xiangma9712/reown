import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta = {
  title: "Components/Input",
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト */
export const Default: Story = {};

/** ラベル付き */
export const WithLabel: Story = {
  args: {
    label: "ユーザー名",
    id: "username",
    placeholder: "入力してください",
  },
};

/** エラー状態 */
export const WithError: Story = {
  args: {
    label: "メールアドレス",
    id: "email",
    value: "invalid-email",
    error: "有効なメールアドレスを入力してください",
  },
};

/** 無効化 */
export const Disabled: Story = {
  args: {
    label: "読み取り専用",
    id: "readonly",
    value: "変更できません",
    disabled: true,
  },
};
