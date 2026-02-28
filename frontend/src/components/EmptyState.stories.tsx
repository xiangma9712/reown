import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  args: {
    message: "No items found.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** メッセージのみ */
export const Default: Story = {};

/** メッセージ + 説明文 */
export const WithDescription: Story = {
  args: {
    message: "No repositories",
    description: 'Click "Add Repository" below to get started.',
  },
};

/** アイコン付き */
export const WithIcon: Story = {
  args: {
    message: "No repositories",
    description: 'Click "Add Repository" below to get started.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      </svg>
    ),
  },
};

/** CTA付き */
export const WithCta: Story = {
  args: {
    message: "No items found.",
    description: "Get started by adding your first item.",
    children: (
      <button className="rounded bg-accent px-3 py-1.5 text-sm text-white">
        Add Item
      </button>
    ),
  },
};
