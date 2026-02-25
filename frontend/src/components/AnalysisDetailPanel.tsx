import { useTranslation } from "react-i18next";
import type {
  AnalysisResult,
  ChangeCategory,
  RiskFactor,
  FileAnalysis,
  HybridAnalysisResult,
} from "../types";
import { Card, Panel } from "./Card";
import { Badge } from "./Badge";
import { RiskBadge } from "./RiskBadge";

interface AnalysisDetailPanelProps {
  result: AnalysisResult;
  hybridResult?: HybridAnalysisResult;
}

const categoryIcons: Record<ChangeCategory, string> = {
  Logic: "\u{1F4BB}",
  Refactor: "\u{1F504}",
  Test: "\u{1F9EA}",
  Config: "\u{2699}\uFE0F",
  Documentation: "\u{1F4DD}",
  CI: "\u{1F6E0}\uFE0F",
  Dependency: "\u{1F4E6}",
  Other: "\u{1F4C4}",
};

const categoryLabelKeys: Record<ChangeCategory, string> = {
  Logic: "pr.categoryLogic",
  Refactor: "pr.categoryRefactor",
  Test: "pr.categoryTest",
  Config: "pr.categoryConfig",
  Documentation: "pr.categoryDocumentation",
  CI: "pr.categoryCI",
  Dependency: "pr.categoryDependency",
  Other: "pr.categoryOther",
};

function ImpactWarnings({ factors }: { factors: RiskFactor[] }) {
  const { t } = useTranslation();

  const warnings: string[] = [];
  for (const factor of factors) {
    if (factor.name === "sensitive_paths") {
      if (
        factor.description.includes("DB") ||
        factor.description.includes("migration") ||
        factor.description.includes("database") ||
        factor.description.includes("schema")
      ) {
        warnings.push(t("pr.warningDbLayer"));
      }
      if (
        factor.description.includes("auth") ||
        factor.description.includes("security") ||
        factor.description.includes("セキュリティ")
      ) {
        warnings.push(t("pr.warningAuthLayer"));
      }
      if (
        factor.description.includes("API") ||
        factor.description.includes("api") ||
        factor.description.includes("endpoint")
      ) {
        warnings.push(t("pr.warningApiLayer"));
      }
      if (
        factor.description.includes("deploy") ||
        factor.description.includes("infra") ||
        factor.description.includes("インフラ")
      ) {
        warnings.push(t("pr.warningInfraLayer"));
      }
      // Default warning if no specific match
      if (warnings.length === 0) {
        warnings.push(factor.description);
      }
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((warning, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-1.5 text-[0.8rem] text-warning"
        >
          <span>&#x26A0;&#xFE0F;</span>
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}

function RiskFactorList({ factors }: { factors: RiskFactor[] }) {
  const { t } = useTranslation();

  if (factors.length === 0) {
    return (
      <p className="text-[0.8rem] italic text-text-secondary">
        {t("pr.noRiskFactors")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {factors.map((factor, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 text-[0.8rem]"
        >
          <span className="text-text-primary">{factor.description}</span>
          <span className="shrink-0 font-mono text-text-secondary">
            +{factor.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function FileAnalysisList({ files }: { files: FileAnalysis[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-2 text-[0.8rem]">
          <span>{categoryIcons[file.category]}</span>
          <Badge variant="default">{t(categoryLabelKeys[file.category])}</Badge>
          <span
            className="truncate font-mono text-text-primary"
            title={file.path}
          >
            {file.path}
          </span>
          <span className="ml-auto shrink-0 font-mono text-accent">
            +{file.additions}
          </span>
          <span className="shrink-0 font-mono text-danger">
            -{file.deletions}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalysisDetailPanel({
  result,
  hybridResult,
}: AnalysisDetailPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="mt-4 space-y-4">
      {/* Risk Score Overview */}
      <div className="flex items-center gap-4">
        <RiskBadge
          level={hybridResult?.combined_risk_level ?? result.risk.level}
        />
        <span className="text-[0.85rem] text-text-secondary">
          {t("pr.riskScore", { score: result.risk.score })}
        </span>
      </div>

      {/* Impact Warnings */}
      <ImpactWarnings factors={result.risk.factors} />

      {/* LLM Warnings (if available) */}
      {hybridResult && hybridResult.llm_analysis.risk_warnings.length > 0 && (
        <Panel>
          <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
            {t("pr.riskWarnings")}
          </h3>
          <div className="space-y-1">
            {hybridResult.llm_analysis.risk_warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[0.8rem] text-warning"
              >
                <span>&#x26A0;&#xFE0F;</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Breaking Changes (if available from LLM) */}
      {hybridResult &&
        hybridResult.llm_analysis.breaking_changes.length > 0 && (
          <Panel>
            <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
              {t("pr.breakingChanges")}
            </h3>
            <div className="space-y-2">
              {hybridResult.llm_analysis.breaking_changes.map((change, i) => (
                <div key={i} className="text-[0.8rem]">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        change.severity === "Critical" ? "danger" : "warning"
                      }
                    >
                      {change.severity === "Critical"
                        ? t("pr.severityCritical")
                        : t("pr.severityWarning")}
                    </Badge>
                    {change.file_path && (
                      <span className="font-mono text-text-secondary">
                        {change.file_path}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-text-primary">
                    {change.description}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        )}

      {/* Affected Modules (if available from LLM) */}
      {hybridResult &&
        hybridResult.llm_analysis.affected_modules.length > 0 && (
          <Panel>
            <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
              {t("pr.affectedModules")}
            </h3>
            <div className="space-y-1">
              {hybridResult.llm_analysis.affected_modules.map((mod, i) => (
                <div key={i} className="text-[0.8rem]">
                  <span className="font-semibold text-text-primary">
                    {mod.name}
                  </span>
                  {mod.description && (
                    <span className="text-text-secondary">
                      {" "}
                      — {mod.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

      {/* Risk Factors Breakdown */}
      <Panel>
        <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
          {t("pr.riskFactors")}
        </h3>
        <RiskFactorList factors={result.risk.factors} />
      </Panel>

      {/* File Analysis */}
      <Panel>
        <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
          {t("pr.fileSummary")}
        </h3>
        <FileAnalysisList files={result.files} />
      </Panel>
    </Card>
  );
}
