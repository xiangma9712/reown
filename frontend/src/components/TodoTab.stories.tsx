import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within, waitFor } from "storybook/test";
import { TodoTab } from "./TodoTab";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
  fixtures,
} from "../storybook";

const meta = {
  title: "Components/TodoTab",
  component: TodoTab,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return (
        <MockRepositoryProvider>
          <Story />
        </MockRepositoryProvider>
      );
    },
  ],
} satisfies Meta<typeof TodoTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 初期状態（抽出ボタン表示） */
export const Initial: Story = {};

/** ローディング状態（Spinner表示） */
export const Loading: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      extract_todos: () =>
        new Promise(() => {
          /* never resolves — keep loading */
        }),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "TODO/FIXMEを抽出" });
    await userEvent.click(button);
  },
};

/** TODO/FIXMEアイテム表示 */
export const WithItems: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "TODO/FIXMEを抽出" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("リフレッシュトークンの実装");
    });
  },
};

/** エラー状態 */
export const Error: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      extract_todos: () => Promise.reject("Repository not found"),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "TODO/FIXMEを抽出" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText(/Repository not found/);
    });
  },
};

/** TODOフィルター適用 */
export const FilteredTodo: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "TODO/FIXMEを抽出" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("リフレッシュトークンの実装");
    });
    // TODOフィルターをクリック
    const todoFilter = canvas.getByRole("button", { name: "TODO" });
    await userEvent.click(todoFilter);
  },
};

/** FIXMEフィルター適用 */
export const FilteredFixme: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      extract_todos: () => fixtures.todoItems,
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "TODO/FIXMEを抽出" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("リフレッシュトークンの実装");
    });
    // FIXMEフィルターをクリック
    const fixmeFilter = canvas.getByRole("button", { name: "FIXME" });
    await userEvent.click(fixmeFilter);
  },
};
