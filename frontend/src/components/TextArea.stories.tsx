import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextArea } from "./TextArea";

const meta = {
  title: "Components/TextArea",
  component: TextArea,
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト */
export const Default: Story = {};

/** ラベル付き */
export const WithLabel: Story = {
  args: {
    label: "コメント",
    id: "comment",
    placeholder: "コメントを入力してください",
    rows: 4,
  },
};

/** エラー状態 */
export const WithError: Story = {
  args: {
    label: "説明",
    id: "description",
    value: "短すぎます",
    error: "10文字以上で入力してください",
  },
};

/** 無効化 */
export const Disabled: Story = {
  args: {
    label: "読み取り専用",
    id: "readonly",
    value: "変更できません",
    disabled: true,
    rows: 3,
  },
};
