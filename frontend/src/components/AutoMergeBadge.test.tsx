import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AutoMergeBadge } from "./AutoMergeBadge";
import type { AutoMergeStatus } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "pr.autoApproveMergeEnabled": "Auto Merge: Enabled",
        "pr.autoApproveMergeSkipped": "Auto Merge: Skipped",
        "pr.autoApproveMergeFailed": "Auto Merge: Failed",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("AutoMergeBadge", () => {
  describe("表示/非表示", () => {
    it("status が null の場合はバッジが表示されない", () => {
      const { container } = render(<AutoMergeBadge status={null} />);
      expect(container.innerHTML).toBe("");
    });

    it("status が Enabled の場合はバッジが表示される", () => {
      render(<AutoMergeBadge status="Enabled" />);
      expect(screen.getByText("Auto Merge: Enabled")).toBeInTheDocument();
    });
  });

  describe("成功状態 (Enabled)", () => {
    it("Enabled で緑系バッジが表示される", () => {
      render(<AutoMergeBadge status="Enabled" />);
      const badge = screen.getByText("Auto Merge: Enabled");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-success-bg");
    });

    it("i18n ラベルが正しく表示される", () => {
      render(<AutoMergeBadge status="Enabled" />);
      expect(screen.getByText("Auto Merge: Enabled")).toBeInTheDocument();
    });
  });

  describe("失敗状態 (Failed)", () => {
    it("Failed で赤系バッジが表示される", () => {
      render(<AutoMergeBadge status={{ Failed: "merge conflict" }} />);
      const badge = screen.getByText("Auto Merge: Failed");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-status-deleted-bg");
    });

    it("異なるエラーメッセージでも Failed バッジが表示される", () => {
      render(<AutoMergeBadge status={{ Failed: "branch protection" }} />);
      expect(screen.getByText("Auto Merge: Failed")).toBeInTheDocument();
    });
  });

  describe("スキップ状態 (Skipped / SkippedDueToApproveFail)", () => {
    it("Skipped でグレー系バッジが表示される", () => {
      render(<AutoMergeBadge status="Skipped" />);
      const badge = screen.getByText("Auto Merge: Skipped");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-btn-secondary");
    });

    it("SkippedDueToApproveFail でグレー系バッジが表示される", () => {
      render(<AutoMergeBadge status="SkippedDueToApproveFail" />);
      const badge = screen.getByText("Auto Merge: Skipped");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-btn-secondary");
    });
  });

  describe("状態反映ロジック", () => {
    it.each<{
      status: AutoMergeStatus;
      expectedText: string;
      expectedClass: string;
    }>([
      {
        status: "Enabled",
        expectedText: "Auto Merge: Enabled",
        expectedClass: "bg-success-bg",
      },
      {
        status: { Failed: "error" },
        expectedText: "Auto Merge: Failed",
        expectedClass: "bg-status-deleted-bg",
      },
      {
        status: "Skipped",
        expectedText: "Auto Merge: Skipped",
        expectedClass: "bg-btn-secondary",
      },
      {
        status: "SkippedDueToApproveFail",
        expectedText: "Auto Merge: Skipped",
        expectedClass: "bg-btn-secondary",
      },
    ])(
      "ステータス $status で正しいバッジが表示される",
      ({ status, expectedText, expectedClass }) => {
        render(<AutoMergeBadge status={status} />);
        const badge = screen.getByText(expectedText);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass(expectedClass);
      }
    );

    it("ブランチ切り替え時にバッジ表示が正しく更新される", () => {
      const { rerender } = render(<AutoMergeBadge status="Enabled" />);
      expect(screen.getByText("Auto Merge: Enabled")).toBeInTheDocument();

      rerender(<AutoMergeBadge status={{ Failed: "conflict" }} />);
      expect(screen.getByText("Auto Merge: Failed")).toBeInTheDocument();
      expect(screen.queryByText("Auto Merge: Enabled")).not.toBeInTheDocument();

      rerender(<AutoMergeBadge status="Skipped" />);
      expect(screen.getByText("Auto Merge: Skipped")).toBeInTheDocument();
      expect(screen.queryByText("Auto Merge: Failed")).not.toBeInTheDocument();

      rerender(<AutoMergeBadge status={null} />);
      expect(screen.queryByText("Auto Merge: Skipped")).not.toBeInTheDocument();
      expect(screen.queryByText("Auto Merge: Enabled")).not.toBeInTheDocument();
      expect(screen.queryByText("Auto Merge: Failed")).not.toBeInTheDocument();
    });
  });

  describe("className プロパティ", () => {
    it("カスタム className が適用される", () => {
      render(<AutoMergeBadge status="Enabled" className="ml-2" />);
      expect(screen.getByText("Auto Merge: Enabled")).toHaveClass("ml-2");
    });
  });
});
