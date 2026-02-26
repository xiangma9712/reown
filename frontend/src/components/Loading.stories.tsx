import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loading, Spinner } from "./Loading";

const meta = {
  title: "Components/Loading",
  component: Loading,
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルトローディング表示 */
export const Default: Story = {};

/** Spinner（小） */
export const SpinnerSmall: Story = {
  render: () => <Spinner size="sm" />,
};

/** Spinner（中） */
export const SpinnerMedium: Story = {
  render: () => <Spinner size="md" />,
};
