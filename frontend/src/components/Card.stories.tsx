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
      <CardTitle as="h3" className="mb-2">
        Panel タイトル
      </CardTitle>
      <CardContent>Panelコンポーネントのサンプルコンテンツです。</CardContent>
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

/** CardTitle weight バリアント */
export const CardTitleWeights: Story = {
  args: { children: "placeholder" },
  render: () => (
    <Card>
      <div className="space-y-2">
        <CardTitle weight="medium">font-medium</CardTitle>
        <CardTitle>font-semibold（デフォルト）</CardTitle>
        <CardTitle weight="bold">font-bold</CardTitle>
      </div>
    </Card>
  ),
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
