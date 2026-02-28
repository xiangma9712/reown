import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, Panel } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: {
    children: "placeholder",
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Card デフォルト */
export const CardDefault: Story = {
  args: {
    children: (
      <div>
        <h2 className="mb-2 text-lg text-text-heading">Card タイトル</h2>
        <p className="text-sm text-text-secondary">
          Cardコンポーネントのサンプルコンテンツです。
        </p>
      </div>
    ),
  },
};

/** Panel デフォルト */
export const PanelDefault: Story = {
  args: { children: "placeholder" },
  render: () => (
    <Panel>
      <h3 className="mb-2 text-base text-text-heading">Panel タイトル</h3>
      <p className="text-sm text-text-secondary">
        Panelコンポーネントのサンプルコンテンツです。
      </p>
    </Panel>
  ),
};

/** Card に style prop を適用 */
export const CardWithStyle: Story = {
  args: {
    children: (
      <div>
        <h2 className="mb-2 text-lg text-text-heading">スタイル付き Card</h2>
        <p className="text-sm text-text-secondary">
          style prop でカスタムスタイルを適用した例です。
        </p>
      </div>
    ),
    style: { maxWidth: 320, border: "2px solid #6366f1" },
  },
};

/** Card + Panel ネスト */
export const CardWithPanel: Story = {
  args: { children: "placeholder" },
  render: () => (
    <Card>
      <h2 className="mb-4 text-lg text-text-heading">外側のCard</h2>
      <Panel>
        <p className="text-sm text-text-secondary">内側のPanelコンテンツ</p>
      </Panel>
    </Card>
  ),
};
