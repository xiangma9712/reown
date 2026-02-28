import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileListPanel } from "./FileListPanel";
import { fixtures } from "../storybook";

/** FileListPanel をインタラクティブに表示するためのラッパー */
function FileListPanelWrapper(
  props: Omit<
    React.ComponentProps<typeof FileListPanel>,
    | "fileListWidth"
    | "collapsed"
    | "resizing"
    | "onToggleCollapse"
    | "onResizeStart"
    | "selectedIndex"
    | "onSelectFile"
  > & { defaultCollapsed?: boolean }
) {
  const { defaultCollapsed = false, ...rest } = props;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [selectedIndex, setSelectedIndex] = useState(
    rest.files.length > 0 ? 0 : -1
  );
  return (
    <FileListPanel
      {...rest}
      selectedIndex={selectedIndex}
      onSelectFile={setSelectedIndex}
      fileListWidth={280}
      collapsed={collapsed}
      resizing={false}
      onToggleCollapse={() => setCollapsed((prev) => !prev)}
      onResizeStart={() => {}}
    />
  );
}

const meta = {
  title: "Components/FileListPanel",
  component: FileListPanelWrapper,
  args: {
    title: "Changed Files",
    files: fixtures.fileDiffs,
    loading: false,
    error: null,
    emptyMessage: "No changed files.",
    children: (
      <p className="p-4 text-[0.9rem] italic text-text-secondary">
        Select a file to view diff
      </p>
    ),
  },
} satisfies Meta<typeof FileListPanelWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ファイルリスト付き（デフォルト状態） */
export const Default: Story = {};

/** ローディング状態 */
export const Loading: Story = {
  args: {
    files: [],
    loading: true,
  },
};

/** エラー状態 */
export const Error: Story = {
  args: {
    files: [],
    error: "Reference 'feature/broken' not found",
  },
};

/** 空状態 */
export const Empty: Story = {
  args: {
    files: [],
    emptyMessage: "No changed files.",
  },
};

/** 折りたたみ状態 */
export const Collapsed: Story = {
  args: {
    defaultCollapsed: true,
  },
};
