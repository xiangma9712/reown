import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardTitle, CardContent, Panel } from "./Card";

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
        <CardTitle className="mb-2">Card タイトル</CardTitle>
        <CardContent>Cardコンポーネントのサンプルコンテンツです。</CardContent>
      </div>
    ),
  },
};

/** Panel デフォルト */
export const PanelDefault: Story = {
  args: { children: "placeholder" },
  render: () => (
    <Panel>
      <h3 className="mb-2 text-base font-semibold text-text-heading">
        Panel タイトル
      </h3>
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
        <CardTitle className="mb-2">スタイル付き Card</CardTitle>
        <CardContent>
          style prop でカスタムスタイルを適用した例です。
        </CardContent>
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
      <CardTitle className="mb-4">外側のCard</CardTitle>
      <Panel>
        <p className="text-sm text-text-secondary">内側のPanelコンテンツ</p>
      </Panel>
    </Card>
  ),
};
