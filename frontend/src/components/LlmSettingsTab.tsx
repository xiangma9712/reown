import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "./Input";
import { Button } from "./Button";
import { invoke } from "../invoke";
import type { LlmConfig } from "../types";

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function LlmSettingsTab() {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await invoke("load_llm_config");
      setEndpoint(config.llm_endpoint);
      setModel(config.llm_model);
      setApiKeyStored(config.llm_api_key_stored);
      setApiKey("");
    } catch (e) {
      setMessage({
        type: "error",
        text: t("llmSettings.loadError", {
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

      const llmConfig: LlmConfig = {
        llm_endpoint: endpoint,
        llm_model: model,
        llm_api_key_stored: apiKey ? true : apiKeyStored,
      };
      await invoke("save_llm_config", { llmConfig });

      if (apiKey) {
        await invoke("save_llm_api_key", { apiKey });
        setApiKeyStored(true);
        setApiKey("");
      }

      setMessage({ type: "success", text: t("llmSettings.saveSuccess") });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("llmSettings.saveError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [endpoint, model, apiKey, apiKeyStored, t]);

  const handleReset = useCallback(() => {
    setMessage(null);
    loadConfig();
  }, [loadConfig]);

  const handleTest = useCallback(async () => {
    try {
      setTesting(true);
      setMessage(null);
      await invoke("test_llm_connection", {
        endpoint,
        model,
        apiKey: apiKey || undefined,
      });
      setMessage({ type: "success", text: t("llmSettings.testSuccess") });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("llmSettings.testError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setTesting(false);
    }
  }, [endpoint, model, apiKey, t]);

  const handleDeleteApiKey = useCallback(async () => {
    try {
      setMessage(null);
      await invoke("delete_llm_api_key");
      setApiKeyStored(false);
      setApiKey("");
      setMessage({
        type: "success",
        text: t("llmSettings.apiKeyDeleted"),
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("common.error", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
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
      <h2 className="text-lg font-bold text-text-heading">
        {t("llmSettings.title")}
      </h2>

      <div className="space-y-4">
        <Input
          label={t("llmSettings.endpoint")}
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.anthropic.com"
        />

        <Input
          label={t("llmSettings.model")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-sonnet-4-5-20250929"
        />

        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t("llmSettings.apiKey")}
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={
                showApiKey
                  ? t("llmSettings.hideApiKey")
                  : t("llmSettings.showApiKey")
              }
            >
              {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
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
          {t("llmSettings.save")}
        </Button>
        <Button onClick={handleReset} variant="secondary">
          {t("llmSettings.reset")}
        </Button>
        <Button onClick={handleTest} variant="secondary" loading={testing}>
          {t("llmSettings.testConnection")}
        </Button>
      </div>
    </div>
  );
}
