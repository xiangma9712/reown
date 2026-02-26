import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffViewer } from "./DiffViewer";
import { fixtures } from "../storybook";

const meta = {
  title: "Components/DiffViewer",
  component: DiffViewer,
  args: {
    diff: fixtures.fileDiffs[0],
  },
} satisfies Meta<typeof DiffViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Modified ファイル（追加・削除・コンテキスト行を含む） */
export const Modified: Story = {};

/** Added ファイル（全行が追加行） */
export const Added: Story = {
  args: {
    diff: fixtures.fileDiffs[1],
  },
};

/** Deleted ファイル（チャンクなし、バイナリメッセージ表示） */
export const Deleted: Story = {
  args: {
    diff: fixtures.fileDiffs[2],
  },
};

/** 複数チャンクのファイル（チャンク間セパレーター表示） */
export const MultipleChunks: Story = {
  args: {
    diff: {
      old_path: "src/utils/helpers.ts",
      new_path: "src/utils/helpers.ts",
      status: "Modified",
      chunks: [
        {
          header: "@@ -5,4 +5,6 @@ export function formatDate()",
          lines: [
            {
              origin: "Context",
              old_lineno: 5,
              new_lineno: 5,
              content: "  const d = new Date(input);",
            },
            {
              origin: "Deletion",
              old_lineno: 6,
              new_lineno: null,
              content: '  return d.toLocaleDateString("en-US");',
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 6,
              content: '  return d.toLocaleDateString("ja-JP");',
            },
            {
              origin: "Context",
              old_lineno: 7,
              new_lineno: 7,
              content: "}",
            },
          ],
        },
        {
          header: "@@ -20,3 +22,8 @@ export function truncate()",
          lines: [
            {
              origin: "Context",
              old_lineno: 20,
              new_lineno: 22,
              content: "  return str.slice(0, len);",
            },
            {
              origin: "Context",
              old_lineno: 21,
              new_lineno: 23,
              content: "}",
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 24,
              content: "",
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 25,
              content: "export function capitalize(str: string): string {",
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 26,
              content: "  return str.charAt(0).toUpperCase() + str.slice(1);",
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 27,
              content: "}",
            },
          ],
        },
      ],
    },
  },
};

/** Renamed ファイル */
export const Renamed: Story = {
  args: {
    diff: {
      old_path: "src/old-name.ts",
      new_path: "src/new-name.ts",
      status: "Renamed",
      chunks: [
        {
          header: "@@ -1,3 +1,3 @@",
          lines: [
            {
              origin: "Deletion",
              old_lineno: 1,
              new_lineno: null,
              content: 'export const NAME = "old";',
            },
            {
              origin: "Addition",
              old_lineno: null,
              new_lineno: 1,
              content: 'export const NAME = "new";',
            },
            {
              origin: "Context",
              old_lineno: 2,
              new_lineno: 2,
              content: "",
            },
          ],
        },
      ],
    },
  },
};
