import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Input } from "./Input";
import { Button } from "./Button";
import { useLlmSettings } from "../hooks/useLlmSettings";

interface SetupWizardStep3Props {
  onNext: () => void;
  onSkip: () => void;
}

export function SetupWizardStep3({ onNext, onSkip }: SetupWizardStep3Props) {
  const { t } = useTranslation();

  const {
    endpoint,
    setEndpoint,
    model,
    setModel,
    apiKey,
    setApiKey,
    showApiKey,
    toggleShowApiKey,
    saving,
    testing,
    testResult,
    message,
    handleTest,
    handleSave,
  } = useLlmSettings({
    defaultEndpoint: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-5-20250929",
    testSuccessKey: "onboarding.step3TestSuccess",
    testErrorKey: "onboarding.step3TestError",
    saveSuccessKey: "onboarding.step3SaveSuccess",
    saveErrorKey: "onboarding.step3SaveError",
    onSaveSuccess: onNext,
  });

  const isConfigured = testResult === "success";

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {t("onboarding.step3Title")}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t("onboarding.step3Description")}
          </p>
        </div>

        <Card>
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
                    placeholder={t("llmSettings.apiKeyPlaceholder")}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={toggleShowApiKey}
                  className="mb-0"
                >
                  {showApiKey
                    ? t("llmSettings.hideApiKey")
                    : t("llmSettings.showApiKey")}
                </Button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={handleTest}
              loading={testing}
            >
              {t("llmSettings.testConnection")}
            </Button>
          </div>
        </Card>

        {message && (
          <div
            className={`rounded border px-4 py-2 text-sm ${
              message.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="cursor-pointer border-none bg-transparent text-sm text-text-muted hover:text-text-secondary hover:underline"
          >
            {t("onboarding.skip")}
          </button>
          {isConfigured ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              loading={saving}
            >
              {t("onboarding.next")}
            </Button>
          ) : (
            <p className="text-xs text-text-muted">
              {t("onboarding.step3SkipNote")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
