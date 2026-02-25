/**
 * Storybook用テストフィクスチャデータ。
 *
 * 全コマンドのモックレスポンスで使用するサンプルデータを定義。
 */
import type {
  WorktreeInfo,
  BranchInfo,
  EnrichedBranchInfo,
  FileDiff,
  CategorizedFileDiff,
  PrInfo,
  CommitInfo,
  RepositoryEntry,
  RepoInfo,
  AppConfig,
  LlmConfig,
  AutomationConfig,
  PrSummary,
  ConsistencyResult,
  AnalysisResult,
  HybridAnalysisResult,
  TodoItem,
  ReviewSuggestion,
} from "../types";

const worktrees: WorktreeInfo[] = [
  {
    name: "main",
    path: "/Users/dev/project",
    branch: "main",
    is_main: true,
    is_locked: false,
  },
  {
    name: "feature-auth",
    path: "/Users/dev/project-feature-auth",
    branch: "feature/auth",
    is_main: false,
    is_locked: false,
  },
  {
    name: "hotfix-login",
    path: "/Users/dev/project-hotfix-login",
    branch: "hotfix/login-fix",
    is_main: false,
    is_locked: true,
  },
];

const branches: BranchInfo[] = [
  { name: "main", is_head: true, upstream: "origin/main" },
  { name: "feature/auth", is_head: false, upstream: "origin/feature/auth" },
  { name: "feature/dashboard", is_head: false, upstream: null },
  {
    name: "hotfix/login-fix",
    is_head: false,
    upstream: "origin/hotfix/login-fix",
  },
  { name: "release/v1.0", is_head: false, upstream: "origin/release/v1.0" },
];

const enrichedBranches: EnrichedBranchInfo[] = [
  {
    name: "main",
    is_head: true,
    upstream: "origin/main",
    is_local: true,
    is_remote: true,
    has_worktree: true,
    worktree_path: "/Users/dev/project",
    pr_number: null,
    pr_title: null,
  },
  {
    name: "feature/auth",
    is_head: false,
    upstream: "origin/feature/auth",
    is_local: true,
    is_remote: true,
    has_worktree: true,
    worktree_path: "/Users/dev/project-feature-auth",
    pr_number: 42,
    pr_title: "認証機能の追加",
  },
  {
    name: "feature/dashboard",
    is_head: false,
    upstream: null,
    is_local: true,
    is_remote: false,
    has_worktree: false,
    worktree_path: null,
    pr_number: null,
    pr_title: null,
  },
  {
    name: "hotfix/login-fix",
    is_head: false,
    upstream: "origin/hotfix/login-fix",
    is_local: true,
    is_remote: true,
    has_worktree: true,
    worktree_path: "/Users/dev/project-hotfix-login",
    pr_number: 38,
    pr_title: "ログインバグの修正",
  },
];

const fileDiffs: FileDiff[] = [
  {
    old_path: "src/auth.ts",
    new_path: "src/auth.ts",
    status: "Modified",
    chunks: [
      {
        header: "@@ -10,6 +10,12 @@ export function authenticate()",
        lines: [
          {
            origin: "Context",
            old_lineno: 10,
            new_lineno: 10,
            content: "  const token = getToken();",
          },
          {
            origin: "Context",
            old_lineno: 11,
            new_lineno: 11,
            content: "  if (!token) {",
          },
          {
            origin: "Deletion",
            old_lineno: 12,
            new_lineno: null,
            content: "    return false;",
          },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 12,
            content: "    throw new AuthError('Token not found');",
          },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 13,
            content: "  }",
          },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 14,
            content: "  if (isExpired(token)) {",
          },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 15,
            content: "    throw new AuthError('Token expired');",
          },
          { origin: "Context", old_lineno: 13, new_lineno: 16, content: "  }" },
        ],
      },
    ],
  },
  {
    old_path: null,
    new_path: "src/components/LoginForm.tsx",
    status: "Added",
    chunks: [
      {
        header: "@@ -0,0 +1,20 @@",
        lines: [
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 1,
            content: 'import React from "react";',
          },
          { origin: "Addition", old_lineno: null, new_lineno: 2, content: "" },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 3,
            content: "export function LoginForm() {",
          },
          {
            origin: "Addition",
            old_lineno: null,
            new_lineno: 4,
            content: '  return <form className="login-form">...</form>;',
          },
          { origin: "Addition", old_lineno: null, new_lineno: 5, content: "}" },
        ],
      },
    ],
  },
  {
    old_path: "src/legacy/old-auth.ts",
    new_path: null,
    status: "Deleted",
    chunks: [],
  },
];

const categorizedFileDiffs: CategorizedFileDiff[] = [
  { ...fileDiffs[0], category: "Logic" },
  { ...fileDiffs[1], category: "Logic" },
  { ...fileDiffs[2], category: "Refactor" },
];

const pullRequests: PrInfo[] = [
  {
    number: 42,
    title: "feat: 認証機能の追加",
    author: "agent-bot",
    state: "open",
    head_branch: "feature/auth",
    base_branch: "main",
    updated_at: "2025-01-15T10:30:00Z",
    additions: 150,
    deletions: 20,
    changed_files: 8,
    body: "認証機能を追加しました。JWT トークンベースの認証を実装しています。",
    html_url: "https://github.com/example/repo/pull/42",
  },
  {
    number: 38,
    title: "fix: ログイン画面のバグ修正",
    author: "dev-user",
    state: "open",
    head_branch: "hotfix/login-fix",
    base_branch: "main",
    updated_at: "2025-01-14T08:00:00Z",
    additions: 10,
    deletions: 5,
    changed_files: 2,
    body: "ログイン画面でパスワードが正しくバリデーションされない問題を修正。",
    html_url: "https://github.com/example/repo/pull/38",
  },
  {
    number: 35,
    title: "chore: 依存関係の更新",
    author: "dependabot",
    state: "closed",
    head_branch: "dependabot/npm_and_yarn/react-19",
    base_branch: "main",
    updated_at: "2025-01-13T12:00:00Z",
    additions: 50,
    deletions: 50,
    changed_files: 1,
    body: "React を v19 にアップデートします。",
    html_url: "https://github.com/example/repo/pull/35",
  },
];

const commits: CommitInfo[] = [
  {
    sha: "abc1234567890abcdef1234567890abcdef123456",
    message: "feat: JWT認証の基盤実装",
    author: "agent-bot",
    date: "2025-01-15T09:00:00Z",
    commit_url: "https://github.com/example/repo/commit/abc123",
  },
  {
    sha: "def4567890abcdef1234567890abcdef456789ab",
    message: "feat: ログインフォームコンポーネントの追加",
    author: "agent-bot",
    date: "2025-01-15T10:00:00Z",
    commit_url: "https://github.com/example/repo/commit/def456",
  },
  {
    sha: "ghi7890abcdef1234567890abcdef7890abcdef12",
    message: "test: 認証テストの追加",
    author: "agent-bot",
    date: "2025-01-15T10:30:00Z",
    commit_url: "https://github.com/example/repo/commit/ghi789",
  },
];

const repositories: RepositoryEntry[] = [
  { name: "reown", path: "/Users/dev/project" },
  { name: "other-project", path: "/Users/dev/other-project" },
];

const repoInfo: RepoInfo = {
  path: "/Users/dev/project",
  name: "reown",
  remote_url: "https://github.com/example/reown.git",
  github_owner: "example",
  github_repo: "reown",
};

const llmConfig: LlmConfig = {
  llm_endpoint: "https://api.openai.com/v1",
  llm_model: "gpt-4",
  llm_api_key_stored: true,
};

const automationConfig: AutomationConfig = {
  enabled: false,
  auto_approve_max_risk: "Low",
  enable_auto_merge: false,
  auto_merge_method: "Squash",
};

const appConfig: AppConfig = {
  github_token: "",
  default_owner: "example",
  default_repo: "reown",
  llm: llmConfig,
  automation: automationConfig,
};

const prSummary: PrSummary = {
  overall_summary:
    "認証機能を追加するPRです。JWTトークンによる認証基盤の実装と、ログインフォームUIの追加を含みます。",
  reason: "ユーザー認証が未実装であり、セキュアなアクセス制御が必要なため。",
  file_summaries: [
    {
      path: "src/auth.ts",
      summary:
        "JWT認証のコアロジックを実装。トークンの検証とエラーハンドリングを追加。",
    },
    {
      path: "src/components/LoginForm.tsx",
      summary: "ログインフォームのReactコンポーネントを新規作成。",
    },
  ],
};

const consistencyResult: ConsistencyResult = {
  is_consistent: true,
  warnings: [],
};

const analysisResult: AnalysisResult = {
  pr_number: 42,
  risk: {
    score: 35,
    level: "Medium",
    factors: [
      {
        name: "ファイル変更数",
        score: 15,
        description: "8ファイルが変更されています",
      },
      {
        name: "ロジック変更",
        score: 20,
        description: "認証ロジックの新規追加",
      },
    ],
  },
  files: [
    { path: "src/auth.ts", category: "Logic", additions: 50, deletions: 10 },
    {
      path: "src/components/LoginForm.tsx",
      category: "Logic",
      additions: 100,
      deletions: 0,
    },
  ],
  summary: {
    total_files: 8,
    total_additions: 150,
    total_deletions: 20,
    has_test_changes: true,
    categories: [
      { category: "Logic", count: 5 },
      { category: "Test", count: 2 },
      { category: "Config", count: 1 },
    ],
  },
};

const hybridAnalysisResult: HybridAnalysisResult = {
  static_analysis: analysisResult,
  llm_analysis: {
    affected_modules: [
      { name: "認証モジュール", description: "新しいJWT認証基盤" },
      { name: "UIコンポーネント", description: "ログインフォームの追加" },
    ],
    breaking_changes: [],
    risk_warnings: [
      "認証ロジックの変更はセキュリティに影響する可能性があります",
    ],
    llm_risk_level: "Medium",
    summary:
      "認証機能の追加PR。JWTベースの認証を実装し、ログインUIを追加。テストも含まれており、品質は担保されている。",
  },
  combined_risk_level: "Medium",
};

const todoItems: TodoItem[] = [
  {
    file_path: "src/auth.ts",
    line_number: 25,
    kind: "Todo",
    content: "リフレッシュトークンの実装",
  },
  {
    file_path: "src/components/LoginForm.tsx",
    line_number: 10,
    kind: "Todo",
    content: "バリデーションエラーの表示",
  },
  {
    file_path: "src/legacy/old-auth.ts",
    line_number: 1,
    kind: "Fixme",
    content: "このファイルは削除予定",
  },
];

const reviewSuggestions: ReviewSuggestion[] = [
  {
    message:
      "認証トークンの有効期限チェックが追加されていますが、リフレッシュトークンのフローも検討してください。",
    severity: "Info",
    source: "pattern-based",
  },
  {
    message:
      "エラーメッセージにスタックトレースが含まれる可能性があります。本番環境では非表示にしてください。",
    severity: "Warning",
    source: "llm-based",
  },
];

export const fixtures = {
  worktrees,
  branches,
  enrichedBranches,
  fileDiffs,
  categorizedFileDiffs,
  pullRequests,
  commits,
  repositories,
  repoInfo,
  llmConfig,
  automationConfig,
  appConfig,
  prSummary,
  consistencyResult,
  analysisResult,
  hybridAnalysisResult,
  todoItems,
  reviewSuggestions,
};
