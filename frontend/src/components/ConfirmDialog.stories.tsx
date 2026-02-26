import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ConfirmDialog } from "./ConfirmDialog";

const meta = {
  title: "Components/ConfirmDialog",
  component: ConfirmDialog,
  args: {
    open: true,
    message: "このリポジトリを削除しますか？",
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 削除確認（destructive） */
export const Destructive: Story = {};

/** 確認ダイアログ（primary） */
export const Primary: Story = {
  args: {
    message: "この操作を実行しますか？",
    confirmLabel: "実行",
    confirmVariant: "primary",
  },
};

/** 子要素付き */
export const WithChildren: Story = {
  args: {
    message: "以下のPRを自動Approveします。よろしいですか？",
    confirmLabel: "Approve",
    confirmVariant: "primary",
    children: (
      <div className="mb-4 rounded border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
        <p>#42 feat: 認証機能の追加 — リスク: Low</p>
        <p>#38 fix: ログイン画面のバグ修正 — リスク: Low</p>
      </div>
    ),
  },
};
