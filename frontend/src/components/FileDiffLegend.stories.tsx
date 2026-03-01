import type { Meta, StoryObj } from "@storybook/react-vite";
import i18n from "../i18n";
import { FileDiffLegend } from "./FileDiffLegend";

const meta = {
  title: "Components/FileDiffLegend",
  component: FileDiffLegend,
} satisfies Meta<typeof FileDiffLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（日本語） */
export const Default: Story = {};

/** 英語表示 */
export const English: Story = {
  decorators: [
    (Story) => {
      const prev = i18n.language;
      i18n.changeLanguage("en");
      return (
        <div
          ref={() => {
            return () => {
              i18n.changeLanguage(prev);
            };
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};
