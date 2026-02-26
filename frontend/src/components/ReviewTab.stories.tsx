import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewTab } from "./ReviewTab";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
  fixtures,
} from "../storybook";

const meta = {
  title: "Components/ReviewTab",
  component: ReviewTab,
  args: {
    selectedBranch: null,
    prs: [],
  },
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
} satisfies Meta<typeof ReviewTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ブランチ未選択 */
export const NoBranch: Story = {};

/** mainブランチ選択時 */
export const MainBranch: Story = {
  args: { selectedBranch: "main" },
};

/** 差分なし（空状態） */
export const Empty: Story = {
  args: { selectedBranch: "feature/empty" },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () => [],
      });
      return <Story />;
    },
  ],
};

/** ローディング状態 */
export const Loading: Story = {
  args: { selectedBranch: "feature/auth" },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
};

/** エラー状態 */
export const Error: Story = {
  args: { selectedBranch: "feature/broken" },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () =>
          Promise.reject("Reference 'feature/broken' not found"),
      });
      return <Story />;
    },
  ],
};

/** 差分あり（PR関連なし） */
export const WithDiffs: Story = {
  args: { selectedBranch: "feature/auth" },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () => fixtures.fileDiffs,
      });
      return <Story />;
    },
  ],
};

/** PR関連付きの差分表示 */
export const WithPrInfo: Story = {
  args: {
    selectedBranch: "feature/auth",
    prs: fixtures.pullRequests,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () => fixtures.fileDiffs,
        load_app_config: () => ({
          ...fixtures.appConfig,
          github_token: "ghp_dummy",
        }),
        get_pull_request_files: () => fixtures.categorizedFileDiffs,
        analyze_pr_risk: () => fixtures.analysisResult,
        analyze_pr_risk_with_llm: () => fixtures.hybridAnalysisResult,
      });
      return <Story />;
    },
  ],
};

/** PRファイル差分ローディング状態 */
export const PrFilesLoading: Story = {
  args: {
    selectedBranch: "feature/auth",
    prs: fixtures.pullRequests,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () => fixtures.fileDiffs,
        load_app_config: () => ({
          ...fixtures.appConfig,
          github_token: "ghp_dummy",
        }),
        get_pull_request_files: () =>
          new Promise(() => {
            /* never resolves */
          }),
        analyze_pr_risk: () =>
          new Promise(() => {
            /* never resolves */
          }),
        analyze_pr_risk_with_llm: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
};

/** PRファイル差分エラー状態 */
export const PrFilesError: Story = {
  args: {
    selectedBranch: "feature/auth",
    prs: fixtures.pullRequests,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        diff_branches: () => fixtures.fileDiffs,
        load_app_config: () => ({
          ...fixtures.appConfig,
          github_token: "ghp_dummy",
        }),
        get_pull_request_files: () =>
          Promise.reject("GitHub API rate limit exceeded"),
        analyze_pr_risk: () =>
          new Promise(() => {
            /* never resolves */
          }),
        analyze_pr_risk_with_llm: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
};
