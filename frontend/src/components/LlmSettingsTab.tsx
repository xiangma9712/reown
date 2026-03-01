import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "./Input";
import { Button } from "./Button";
import { invoke } from "../invoke";
import { useLlmSettings } from "../hooks/useLlmSettings";
import { EyeIcon, EyeOffIcon } from "./icons";

export function LlmSettingsTab() {
  const { t } = useTranslation();
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [loading, setLoading] = useState(true);

  const llm = useLlmSettings();

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await invoke("load_llm_config");
      llm.setEndpoint(config.llm_endpoint);
      llm.setModel(config.llm_model);
      setApiKeyStored(config.llm_api_key_stored);
      llm.setApiKey("");
      llm.setMessage(null);
    } catch (e) {
      llm.setMessage({
        type: "error",
        text: t("llmSettings.loadError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    try {
      llm.setSaving(true);
      llm.setMessage(null);

      const llmConfig = {
        llm_endpoint: llm.endpoint,
        llm_model: llm.model,
        llm_api_key_stored: llm.apiKey ? true : apiKeyStored,
      };
      await invoke("save_llm_config", { llmConfig });

      if (llm.apiKey) {
        await invoke("save_llm_api_key", { apiKey: llm.apiKey });
        setApiKeyStored(true);
        llm.setApiKey("");
      }

      llm.setMessage({
        type: "success",
        text: t("llmSettings.saveSuccess"),
      });
    } catch (e) {
      llm.setMessage({
        type: "error",
        text: t("llmSettings.saveError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      llm.setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.endpoint, llm.model, llm.apiKey, apiKeyStored, t]);

  const handleReset = useCallback(() => {
    llm.setMessage(null);
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConfig]);

  const handleDeleteApiKey = useCallback(async () => {
    try {
      llm.setMessage(null);
      await invoke("delete_llm_api_key");
      setApiKeyStored(false);
      llm.setApiKey("");
      llm.setMessage({
        type: "success",
        text: t("llmSettings.apiKeyDeleted"),
      });
    } catch (e) {
      llm.setMessage({
        type: "error",
        text: t("common.error", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <h2 className="text-lg font-bold text-text-heading">
        {t("llmSettings.title")}
      </h2>

      <div className="space-y-4">
        <Input
          label={t("llmSettings.endpoint")}
          value={llm.endpoint}
          onChange={(e) => llm.setEndpoint(e.target.value)}
          placeholder="https://api.anthropic.com"
        />

        <Input
          label={t("llmSettings.model")}
          value={llm.model}
          onChange={(e) => llm.setModel(e.target.value)}
          placeholder="claude-sonnet-4-5-20250929"
        />

        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t("llmSettings.apiKey")}
                type={llm.showApiKey ? "text" : "password"}
                value={llm.apiKey}
                onChange={(e) => llm.setApiKey(e.target.value)}
                placeholder={
                  apiKeyStored
                    ? t("llmSettings.apiKeyStoredPlaceholder")
                    : t("llmSettings.apiKeyPlaceholder")
                }
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={llm.toggleShowApiKey}
              aria-label={
                llm.showApiKey
                  ? t("llmSettings.hideApiKey")
                  : t("llmSettings.showApiKey")
              }
            >
              {llm.showApiKey ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          {apiKeyStored && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[0.75rem] text-success">
                {t("llmSettings.apiKeyStored")}
              </span>
              <button
                onClick={handleDeleteApiKey}
                className="cursor-pointer border-none bg-transparent text-[0.75rem] text-danger hover:underline"
              >
                {t("llmSettings.deleteApiKey")}
              </button>
            </div>
          )}
        </div>
      </div>

      {llm.message && (
        <div
          className={`rounded border px-4 py-2 text-[0.85rem] ${
            llm.message.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {llm.message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant="primary" loading={llm.saving}>
          {t("llmSettings.save")}
        </Button>
        <Button onClick={handleReset} variant="secondary">
          {t("llmSettings.reset")}
        </Button>
        <Button
          onClick={llm.handleTest}
          variant="secondary"
          loading={llm.testing}
        >
          {t("llmSettings.testConnection")}
        </Button>
      </div>
    </div>
  );
}
