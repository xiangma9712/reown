import type { Meta, StoryObj } from "@storybook/react-vite";
import { fixtures } from "../storybook";
import { AnalysisDetailPanel } from "./AnalysisDetailPanel";
import type { AnalysisResult, HybridAnalysisResult } from "../types";

const meta = {
  title: "Components/AnalysisDetailPanel",
  component: AnalysisDetailPanel,
  args: {
    result: fixtures.analysisResult,
  },
} satisfies Meta<typeof AnalysisDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 静的分析のみ（LLM分析なし） */
export const StaticOnly: Story = {};

/** ハイブリッド分析結果（LLM分析あり） */
export const WithLlmAnalysis: Story = {
  args: {
    result: fixtures.hybridAnalysisResult.static_analysis,
    hybridResult: fixtures.hybridAnalysisResult,
  },
};

/** 低リスク: リスクファクターなし */
export const LowRisk: Story = {
  args: {
    result: {
      pr_number: 38,
      risk: {
        score: 5,
        level: "Low",
        factors: [],
      },
      files: [
        {
          path: "README.md",
          category: "Documentation",
          additions: 10,
          deletions: 2,
        },
      ],
      summary: {
        total_files: 1,
        total_additions: 10,
        total_deletions: 2,
        has_test_changes: false,
        categories: [{ category: "Documentation", count: 1 }],
      },
    } satisfies AnalysisResult,
  },
};

/** 高リスク: 破壊的変更あり */
export const HighRiskWithBreakingChanges: Story = {
  args: {
    result: {
      pr_number: 99,
      risk: {
        score: 80,
        level: "High",
        factors: [
          {
            name: "sensitive_paths",
            score: 30,
            description: "DB migration ファイルが変更されています",
          },
          {
            name: "sensitive_paths",
            score: 25,
            description: "auth モジュールが変更されています",
          },
          {
            name: "ファイル変更数",
            score: 25,
            description: "20ファイルが変更されています",
          },
        ],
      },
      files: [
        {
          path: "src/db/migration.sql",
          category: "Config",
          additions: 50,
          deletions: 10,
        },
        {
          path: "src/auth/handler.ts",
          category: "Logic",
          additions: 200,
          deletions: 80,
        },
        {
          path: "src/api/routes.ts",
          category: "Logic",
          additions: 100,
          deletions: 30,
        },
        {
          path: "tests/auth.test.ts",
          category: "Test",
          additions: 150,
          deletions: 0,
        },
      ],
      summary: {
        total_files: 20,
        total_additions: 500,
        total_deletions: 120,
        has_test_changes: true,
        categories: [
          { category: "Logic", count: 12 },
          { category: "Test", count: 5 },
          { category: "Config", count: 3 },
        ],
      },
    } satisfies AnalysisResult,
    hybridResult: {
      static_analysis: {} as AnalysisResult, // replaced by result prop
      llm_analysis: {
        affected_modules: [
          {
            name: "データベース",
            description: "スキーマ変更とマイグレーション",
          },
          {
            name: "認証システム",
            description: "OAuth2フローの全面的な書き換え",
          },
          {
            name: "APIルーティング",
            description: "エンドポイントの再構成",
          },
        ],
        breaking_changes: [
          {
            file_path: "src/db/migration.sql",
            description:
              "usersテーブルのカラム名変更により、既存データの移行が必要",
            severity: "Critical",
          },
          {
            file_path: "src/api/routes.ts",
            description:
              "/api/v1/auth エンドポイントのレスポンス形式が変更されています",
            severity: "Warning",
          },
        ],
        risk_warnings: [
          "DB migrationが含まれており、ロールバック計画が必要です",
          "認証フローの変更により、既存セッションが無効になる可能性があります",
        ],
        llm_risk_level: "High",
        summary:
          "認証システムの全面改修。DB schema変更を含む大規模リファクタリング。",
      },
      combined_risk_level: "High",
    } satisfies HybridAnalysisResult,
  },
};
