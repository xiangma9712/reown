import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type {
  AutomationConfig,
  AutoApproveMaxRisk,
  ChangeCategory,
  ConfigMergeMethod,
  RiskConfig,
} from "../types";

const ALL_CATEGORIES: ChangeCategory[] = [
  "Logic",
  "Test",
  "Config",
  "CI",
  "Documentation",
  "Dependency",
  "Refactor",
  "Other",
];

const CATEGORY_LABEL_KEYS: Record<ChangeCategory, string> = {
  Logic: "pr.categoryLogic",
  Test: "pr.categoryTest",
  Config: "pr.categoryConfig",
  CI: "pr.categoryCI",
  Documentation: "pr.categoryDocumentation",
  Dependency: "pr.categoryDependency",
  Refactor: "pr.categoryRefactor",
  Other: "pr.categoryOther",
};

export function AutomationSettingsTab() {
  const { t } = useTranslation();
  const { repoInfo } = useRepository();
  const owner = repoInfo?.github_owner ?? undefined;
  const repo = repoInfo?.github_repo ?? undefined;
  const [enabled, setEnabled] = useState(false);
  const [maxRisk, setMaxRisk] = useState<AutoApproveMaxRisk>("Low");
  const [enableAutoMerge, setEnableAutoMerge] = useState(false);
  const [autoMergeMethod, setAutoMergeMethod] =
    useState<ConfigMergeMethod>("Merge");
  const [loading, setLoading] = useState(true);
  const [riskConfig, setRiskConfig] = useState<RiskConfig>({
    category_weights: {},
    sensitive_patterns: [],
    file_count_thresholds: [],
    line_count_thresholds: [],
    missing_test_penalty: 15,
    risk_thresholds: { low_max: 25, medium_max: 55 },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [newScore, setNewScore] = useState(15);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await invoke("load_automation_config", { owner, repo });
      setEnabled(config.enabled);
      setMaxRisk(config.auto_approve_max_risk);
      setEnableAutoMerge(config.enable_auto_merge);
      setAutoMergeMethod(config.auto_merge_method);
      setRiskConfig(config.risk_config);
    } catch (e) {
      setMessage({
        type: "error",
        text: t("automation.loadError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setLoading(false);
    }
  }, [t, owner, repo]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setMessage(null);

      const automationConfig: AutomationConfig = {
        enabled,
        auto_approve_max_risk: maxRisk,
        enable_auto_merge: enableAutoMerge,
        auto_merge_method: autoMergeMethod,
        risk_config: riskConfig,
      };
      await invoke("save_automation_config", {
        automationConfig,
        owner,
        repo,
      });

      setMessage({ type: "success", text: t("automation.saveSuccess") });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("automation.saveError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [
    enabled,
    maxRisk,
    enableAutoMerge,
    autoMergeMethod,
    riskConfig,
    t,
    owner,
    repo,
  ]);

  const handleReset = useCallback(() => {
    setMessage(null);
    loadConfig();
  }, [loadConfig]);

  const handleAddPattern = useCallback(() => {
    const trimmed = newPattern.trim();
    if (!trimmed) return;
    setRiskConfig((prev) => ({
      ...prev,
      sensitive_patterns: [
        ...prev.sensitive_patterns,
        { pattern: trimmed, score: newScore },
      ],
    }));
    setNewPattern("");
    setNewScore(15);
  }, [newPattern, newScore]);

  const handleRemovePattern = useCallback((index: number) => {
    setRiskConfig((prev) => ({
      ...prev,
      sensitive_patterns: prev.sensitive_patterns.filter((_, i) => i !== index),
    }));
  }, []);

  const handleResetToDefaults = useCallback(async () => {
    try {
      const defaultConfig = await invoke("load_default_risk_config");
      setRiskConfig(defaultConfig);
      setShowResetConfirm(false);
    } catch (e) {
      setMessage({
        type: "error",
        text: t("automation.loadError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
      setShowResetConfirm(false);
    }
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-heading">
          {t("automation.title")}
        </h2>
        <p className="mt-1 text-[0.85rem] text-text-muted">
          {t("automation.description")}
        </p>
        {owner && repo && (
          <p className="mt-1 text-[0.8rem] text-text-muted">
            {t("automation.repoLabel", { owner, repo })}
          </p>
        )}
      </div>

      <Card>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-[0.9rem] text-text-primary">
              {t("automation.enabled")}
            </span>
          </label>

          {enabled && (
            <div className="space-y-2 pl-7">
              <p className="text-[0.85rem] font-medium text-text-secondary">
                {t("automation.maxRiskLevel")}
              </p>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="maxRisk"
                  value="Low"
                  checked={maxRisk === "Low"}
                  onChange={() => setMaxRisk("Low")}
                  className="accent-accent"
                />
                <span className="text-[0.85rem] text-text-primary">
                  {t("automation.riskLow")}
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="maxRisk"
                  value="Medium"
                  checked={maxRisk === "Medium"}
                  onChange={() => setMaxRisk("Medium")}
                  className="accent-accent"
                />
                <span className="text-[0.85rem] text-text-primary">
                  {t("automation.riskMedium")}
                </span>
              </label>

              <div className="mt-4 border-t border-border pt-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enableAutoMerge}
                    onChange={(e) => setEnableAutoMerge(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-[0.9rem] text-text-primary">
                    {t("automation.enableAutoMerge")}
                  </span>
                </label>

                {enableAutoMerge && (
                  <div className="mt-2 space-y-2 pl-7">
                    <p className="text-[0.85rem] font-medium text-text-secondary">
                      {t("automation.mergeMethod")}
                    </p>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="mergeMethod"
                        value="Merge"
                        checked={autoMergeMethod === "Merge"}
                        onChange={() => setAutoMergeMethod("Merge")}
                        className="accent-accent"
                      />
                      <span className="text-[0.85rem] text-text-primary">
                        {t("automation.mergeMerge")}
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="mergeMethod"
                        value="Squash"
                        checked={autoMergeMethod === "Squash"}
                        onChange={() => setAutoMergeMethod("Squash")}
                        className="accent-accent"
                      />
                      <span className="text-[0.85rem] text-text-primary">
                        {t("automation.mergeSquash")}
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="mergeMethod"
                        value="Rebase"
                        checked={autoMergeMethod === "Rebase"}
                        onChange={() => setAutoMergeMethod("Rebase")}
                        className="accent-accent"
                      />
                      <span className="text-[0.85rem] text-text-primary">
                        {t("automation.mergeRebase")}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {enabled && (
        <Card>
          <div className="space-y-5">
            <div>
              <h3 className="text-[0.95rem] font-bold text-text-heading">
                {t("automation.riskCustomization")}
              </h3>
              <p className="mt-1 text-[0.8rem] text-text-muted">
                {t("automation.riskCustomizationDescription")}
              </p>
            </div>

            {/* Category Weights */}
            <div className="space-y-3">
              <div>
                <p className="text-[0.85rem] font-medium text-text-secondary">
                  {t("automation.categoryWeights")}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-text-muted">
                  {t("automation.categoryWeightsDescription")}
                </p>
              </div>
              <div className="space-y-2">
                {ALL_CATEGORIES.map((cat) => {
                  const weight = riskConfig.category_weights[cat] ?? 1.0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[0.8rem] text-text-primary">
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={weight}
                        onChange={(e) => {
                          setRiskConfig((prev) => ({
                            ...prev,
                            category_weights: {
                              ...prev.category_weights,
                              [cat]: parseFloat(e.target.value),
                            },
                          }));
                        }}
                        className="h-1.5 flex-1 cursor-pointer accent-accent"
                      />
                      <span className="w-10 text-right text-[0.8rem] tabular-nums text-text-muted">
                        {weight.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk Thresholds */}
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <p className="text-[0.85rem] font-medium text-text-secondary">
                  {t("automation.riskThresholds")}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-text-muted">
                  {t("automation.riskThresholdsDescription")}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-[0.8rem] text-text-primary">
                    {t("automation.thresholdLowMax")}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={riskConfig.risk_thresholds.medium_max - 1}
                    value={riskConfig.risk_thresholds.low_max}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setRiskConfig((prev) => {
                          const clamped = Math.max(
                            0,
                            Math.min(val, prev.risk_thresholds.medium_max - 1)
                          );
                          return {
                            ...prev,
                            risk_thresholds: {
                              ...prev.risk_thresholds,
                              low_max: clamped,
                            },
                          };
                        });
                      }
                    }}
                    className="w-20 rounded border border-border bg-bg-primary px-2 py-1 text-[0.8rem] text-text-primary"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[0.8rem] text-text-primary">
                    {t("automation.thresholdMediumMax")}
                  </span>
                  <input
                    type="number"
                    min={riskConfig.risk_thresholds.low_max + 1}
                    max="100"
                    value={riskConfig.risk_thresholds.medium_max}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setRiskConfig((prev) => {
                          const clamped = Math.max(
                            prev.risk_thresholds.low_max + 1,
                            Math.min(val, 100)
                          );
                          return {
                            ...prev,
                            risk_thresholds: {
                              ...prev.risk_thresholds,
                              medium_max: clamped,
                            },
                          };
                        });
                      }
                    }}
                    className="w-20 rounded border border-border bg-bg-primary px-2 py-1 text-[0.8rem] text-text-primary"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3 text-[0.75rem] text-text-muted">
                <span>
                  {t("automation.thresholdLowRange", {
                    max: riskConfig.risk_thresholds.low_max,
                  })}
                </span>
                <span>
                  {t("automation.thresholdMediumRange", {
                    min: riskConfig.risk_thresholds.low_max + 1,
                    max: riskConfig.risk_thresholds.medium_max,
                  })}
                </span>
                <span>
                  {t("automation.thresholdHighRange", {
                    min: riskConfig.risk_thresholds.medium_max + 1,
                  })}
                </span>
              </div>
            </div>

            {/* Sensitive Path Patterns */}
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <p className="text-[0.85rem] font-medium text-text-secondary">
                  {t("automation.sensitivePatterns")}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-text-muted">
                  {t("automation.sensitivePatternsDescription")}
                </p>
              </div>

              {riskConfig.sensitive_patterns.length > 0 && (
                <div className="space-y-1">
                  {riskConfig.sensitive_patterns.map((sp, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded border border-border bg-bg-primary px-3 py-1.5"
                    >
                      <span className="flex-1 text-[0.8rem] text-text-primary">
                        {sp.pattern}
                      </span>
                      <span className="text-[0.75rem] tabular-nums text-text-muted">
                        {t("automation.sensitiveScore")}: {sp.score}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePattern(index)}
                        className="ml-1 text-[0.75rem] text-danger hover:text-danger/80"
                        aria-label={`${t("automation.removePattern")} ${sp.pattern}`}
                      >
                        {t("automation.removePattern")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPattern();
                    }
                  }}
                  placeholder={t("automation.addPatternPlaceholder")}
                  className="flex-1 rounded border border-border bg-bg-primary px-2 py-1 text-[0.8rem] text-text-primary placeholder:text-text-muted/50"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newScore}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setNewScore(val);
                  }}
                  className="w-16 rounded border border-border bg-bg-primary px-2 py-1 text-[0.8rem] text-text-primary"
                  aria-label={t("automation.sensitiveScore")}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddPattern}
                  disabled={!newPattern.trim()}
                >
                  {t("automation.addPattern")}
                </Button>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="border-t border-border pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowResetConfirm(true)}
              >
                {t("automation.resetToDefaults")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {message && (
        <div
          className={`rounded border px-4 py-2 text-[0.85rem] ${
            message.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant="primary" loading={saving}>
          {t("automation.save")}
        </Button>
        <Button onClick={handleReset} variant="secondary">
          {t("automation.reset")}
        </Button>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        message={t("automation.confirmResetToDefaults")}
        onConfirm={handleResetToDefaults}
        onCancel={() => setShowResetConfirm(false)}
        confirmLabel={t("automation.resetToDefaults")}
        confirmVariant="destructive"
      />
    </div>
  );
}
