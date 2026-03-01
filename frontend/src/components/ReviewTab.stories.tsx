import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewTab } from "./ReviewTab";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
  fixtures,
} from "../storybook";

/** feature/auth がHEADのenrichedBranches（自動選択でfeature/authが選ばれる） */
const featureHeadBranches = fixtures.enrichedBranches.map((b) => ({
  ...b,
  is_head: b.name === "feature/auth",
}));

const meta = {
  title: "Components/ReviewTab",
  component: ReviewTab,
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

/** ブランチ未選択（初期状態） */
export const NoBranch: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => [],
      });
      return <Story />;
    },
  ],
};

/** mainブランチ選択時 */
export const MainBranch: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => fixtures.enrichedBranches,
      });
      return <Story />;
    },
  ],
};

/** 差分なし（空状態） */
export const Empty: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => [],
      });
      return <Story />;
    },
  ],
};

/** ローディング状態 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
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
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () =>
          Promise.reject("Reference 'feature/broken' not found"),
      });
      return <Story />;
    },
  ],
};

/** 差分あり（PR関連なし） */
export const WithDiffs: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
      });
      return <Story />;
    },
  ],
};

/** PR関連付きの差分表示 */
export const WithPrInfo: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
        get_pull_request_files: () => fixtures.categorizedFileDiffs,
        list_pr_commits: () => fixtures.commits,
        analyze_pr_risk: () => fixtures.analysisResult,
        analyze_pr_risk_with_llm: () => fixtures.hybridAnalysisResult,
      });
      return <Story />;
    },
  ],
};

/** PRファイル差分ローディング状態 */
export const PrFilesLoading: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
        get_pull_request_files: () =>
          new Promise(() => {
            /* never resolves */
          }),
        list_pr_commits: () =>
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
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
        get_pull_request_files: () =>
          Promise.reject("GitHub API rate limit exceeded"),
        list_pr_commits: () => fixtures.commits,
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

/** ファイルリスト折りたたみ状態 */
export const FileListCollapsed: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem("reown-filelist-collapsed", "true");
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
      });
      return <Story />;
    },
  ],
};

/** ファイルリストリサイズ状態（幅400px） */
export const FileListResized: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem("reown-filelist-width", "400");
      localStorage.removeItem("reown-filelist-collapsed");
      overrideInvoke({
        list_enriched_branches: () => featureHeadBranches,
        diff_branches: () => fixtures.fileDiffs,
      });
      return <Story />;
    },
  ],
};

/** 外部からのブランチナビゲーション（差分あり） */
export const NavigateToBranch: Story = {
  args: {
    navigateToBranch: "feature/auth",
    onNavigateConsumed: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => fixtures.enrichedBranches,
        diff_branches: () => fixtures.fileDiffs,
      });
      return <Story />;
    },
  ],
};

/** 外部からのブランチナビゲーション（差分なし） */
export const NavigateToBranchEmpty: Story = {
  args: {
    navigateToBranch: "feature/dashboard",
    onNavigateConsumed: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => fixtures.enrichedBranches,
        diff_branches: () => [],
      });
      return <Story />;
    },
  ],
};
