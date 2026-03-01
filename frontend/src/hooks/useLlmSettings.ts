import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { LlmConfig } from "../types";

export interface UseLlmSettingsOptions {
  /** Initial endpoint value (used when not loading from backend) */
  defaultEndpoint?: string;
  /** Initial model value (used when not loading from backend) */
  defaultModel?: string;
  /** Translation key for test success message */
  testSuccessKey?: string;
  /** Translation key for test error message */
  testErrorKey?: string;
  /** Translation key for save success message */
  saveSuccessKey?: string;
  /** Translation key for save error message */
  saveErrorKey?: string;
  /** Callback after successful save */
  onSaveSuccess?: () => void;
}

export interface LlmSettingsState {
  endpoint: string;
  setEndpoint: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  showApiKey: boolean;
  toggleShowApiKey: () => void;
  saving: boolean;
  setSaving: (value: boolean) => void;
  testing: boolean;
  testResult: "success" | "error" | null;
  message: { type: "success" | "error"; text: string } | null;
  setMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
  handleTest: () => Promise<void>;
  handleSave: () => Promise<void>;
}

export function useLlmSettings(
  options: UseLlmSettingsOptions = {}
): LlmSettingsState {
  const {
    defaultEndpoint = "",
    defaultModel = "",
    testSuccessKey = "llmSettings.testSuccess",
    testErrorKey = "llmSettings.testError",
    saveSuccessKey = "llmSettings.saveSuccess",
    saveErrorKey = "llmSettings.saveError",
    onSaveSuccess,
  } = options;

  const { t } = useTranslation();

  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [model, setModel] = useState(defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const toggleShowApiKey = useCallback(() => {
    setShowApiKey((v) => !v);
  }, []);

  const handleTest = useCallback(async () => {
    try {
      setTesting(true);
      setMessage(null);
      setTestResult(null);
      await invoke("test_llm_connection", {
        endpoint,
        model,
        apiKey: apiKey || undefined,
      });
      setTestResult("success");
      setMessage({ type: "success", text: t(testSuccessKey) });
    } catch (e) {
      setTestResult("error");
      setMessage({
        type: "error",
        text: t(testErrorKey, {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setTesting(false);
    }
  }, [endpoint, model, apiKey, t, testSuccessKey, testErrorKey]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setMessage(null);

      const llmConfig: LlmConfig = {
        llm_endpoint: endpoint,
        llm_model: model,
        llm_api_key_stored: !!apiKey,
      };
      await invoke("save_llm_config", { llmConfig });

      if (apiKey) {
        await invoke("save_llm_api_key", { apiKey });
      }

      setMessage({ type: "success", text: t(saveSuccessKey) });
      onSaveSuccess?.();
    } catch (e) {
      setMessage({
        type: "error",
        text: t(saveErrorKey, {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [endpoint, model, apiKey, t, saveSuccessKey, saveErrorKey, onSaveSuccess]);

  return {
    endpoint,
    setEndpoint,
    model,
    setModel,
    apiKey,
    setApiKey,
    showApiKey,
    toggleShowApiKey,
    saving,
    setSaving,
    testing,
    testResult,
    message,
    setMessage,
    handleTest,
    handleSave,
  };
}
