import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Button } from "./Button";
import { invoke } from "../invoke";
import type {
  AutomationConfig,
  AutoApproveMaxRisk,
  ConfigMergeMethod,
  RiskConfig,
} from "../types";

export function AutomationSettingsTab() {
  const { t } = useTranslation();
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

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await invoke("load_automation_config");
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
  }, [t]);

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
      await invoke("save_automation_config", { automationConfig });

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
  }, [enabled, maxRisk, enableAutoMerge, autoMergeMethod, riskConfig, t]);

  const handleReset = useCallback(() => {
    setMessage(null);
    loadConfig();
  }, [loadConfig]);

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
    </div>
  );
}
