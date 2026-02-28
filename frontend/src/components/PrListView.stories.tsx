import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PrListView } from "./PrListView";
import { fixtures, overrideInvoke, resetInvokeOverrides } from "../storybook";
import type { PrInfo } from "../types";

const mergedPr: PrInfo = {
  number: 30,
  title: "refactor: コンポーネント構造のリファクタリング",
  author: "dev-user",
  state: "merged",
  head_branch: "refactor/components",
  base_branch: "main",
  updated_at: "2025-01-12T15:00:00Z",
  additions: 80,
  deletions: 120,
  changed_files: 6,
  body: "コンポーネントの構造を整理しました。",
  html_url: "https://github.com/example/repo/pull/30",
};

const allPrs = [...fixtures.pullRequests, mergedPr];

const meta = {
  title: "Components/PrListView",
  component: PrListView,
  args: {
    prs: allPrs,
    onSelectPr: fn(),
  },
} satisfies Meta<typeof PrListView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** PR一覧表示（open/closed/merged混在） */
export const Default: Story = {};

/** 状態フィルター（Openフィルター適用状態） */
export const Filter: Story = {};

/** 空状態（PRが0件） */
export const Empty: Story = {
  args: {
    prs: [],
  },
};

/** ローディング状態 */
export const Loading: Story = {
  args: {
    prs: [],
    loading: true,
  },
};

/** エラー状態 */
export const Error: Story = {
  args: {
    prs: [],
    error: "GitHub API rate limit exceeded. Please try again later.",
  },
};

/** リスク分析バッジ付き */
export const WithRiskBadge: Story = {
  args: {
    prs: allPrs,
    riskLevels: {
      42: "Medium",
      38: "Low",
      35: "Low",
      30: "High",
    },
  },
};

/** コミット一覧展開状態（PR行クリックで展開） */
export const WithExpandedCommits: Story = {
  args: {
    prs: allPrs,
    owner: "example",
    repo: "reown",
  },
};

/** コミット一覧エラー状態（PR行クリックで展開） */
export const WithExpandedCommitsError: Story = {
  args: {
    prs: allPrs,
    owner: "example",
    repo: "reown",
  },
  beforeEach: () => {
    overrideInvoke({
      list_pr_commits: () => {
        throw new globalThis.Error("GitHub API rate limit exceeded");
      },
    });
    return () => resetInvokeOverrides();
  },
};
