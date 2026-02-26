import type { Meta, StoryObj } from "@storybook/react-vite";
import { TodoTab } from "./TodoTab";
import { MockRepositoryProvider } from "../storybook/mock-repository-provider";
import {
  overrideInvoke,
  resetInvokeOverrides,
} from "../storybook/tauri-invoke-mock";
import { fixtures } from "../storybook/fixtures";
import type { TodoItem } from "../types";

const meta = {
  title: "Components/TodoTab",
  component: TodoTab,
  decorators: [
    (Story) => (
      <MockRepositoryProvider>
        <div style={{ maxWidth: 800, padding: 16 }}>
          <Story />
        </div>
      </MockRepositoryProvider>
    ),
  ],
} satisfies Meta<typeof TodoTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（読み込み前の空状態） */
export const Default: Story = {
  beforeEach: () => {
    resetInvokeOverrides();
  },
};

/** データ表示状態（TODO + FIXMEアイテムあり） */
export const WithItems: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector("button");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

/** 空の状態（アイテムなし） */
export const Empty: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () => [],
    });
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector("button");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

/** エラー状態 */
export const Error: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () => {
        throw new Error("リポジトリの読み取りに失敗しました");
      },
    });
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector("button");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

/** フィルタ: Todoのみ */
export const FilterTodo: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
  },
  play: async ({ canvasElement }) => {
    const loadButton = canvasElement.querySelector("button");
    loadButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const filterButtons = canvasElement.querySelectorAll(
      ".flex.gap-2 button"
    );
    // filterButtons[1] = "Todo" filter
    (filterButtons[1] as HTMLButtonElement)?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};

/** フィルタ: Fixmeのみ */
export const FilterFixme: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
  },
  play: async ({ canvasElement }) => {
    const loadButton = canvasElement.querySelector("button");
    loadButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const filterButtons = canvasElement.querySelectorAll(
      ".flex.gap-2 button"
    );
    // filterButtons[2] = "Fixme" filter
    (filterButtons[2] as HTMLButtonElement)?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};

/** ローディング状態 */
export const Loading: Story = {
  beforeEach: () => {
    overrideInvoke({
      extract_todos: () =>
        new Promise<TodoItem[]>(() => {
          // never resolves — keeps loading state
        }),
    });
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector("button");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
