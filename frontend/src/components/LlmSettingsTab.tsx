import { useTranslation } from "react-i18next";
import { Input } from "./Input";
import { Button } from "./Button";
import { useLlmSettings } from "../hooks/useLlmSettings";
import { EyeIcon, EyeOffIcon } from "./icons";

export function LlmSettingsTab() {
  const { t } = useTranslation();

  const llm = useLlmSettings({ loadOnMount: true });

  if (llm.loading) {
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
                  llm.apiKeyStored
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
          {llm.apiKeyStored && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[0.75rem] text-success">
                {t("llmSettings.apiKeyStored")}
              </span>
              <button
                onClick={llm.handleDeleteApiKey}
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
        <Button onClick={llm.handleSave} variant="primary" loading={llm.saving}>
          {t("llmSettings.save")}
        </Button>
        <Button onClick={llm.handleReset} variant="secondary">
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
