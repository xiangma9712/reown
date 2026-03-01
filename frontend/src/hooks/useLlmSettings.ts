import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { LlmConfig } from "../types";

export interface UseLlmSettingsOptions {
  /** Initial endpoint value (used when not loading from backend) */
  defaultEndpoint?: string;
  /** Initial model value (used when not loading from backend) */
  defaultModel?: string;
  /** Load existing config from backend on mount (falls back to defaults) */
  loadOnMount?: boolean;
  /** Translation key for test success message */
  testSuccessKey?: string;
  /** Translation key for test error message */
  testErrorKey?: string;
  /** Translation key for save success message */
  saveSuccessKey?: string;
  /** Translation key for save error message */
  saveErrorKey?: string;
  /** Translation key for load error message */
  loadErrorKey?: string;
  /** Translation key for API key deleted message */
  apiKeyDeletedKey?: string;
  /** Translation key for delete error message */
  deleteErrorKey?: string;
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
  testing: boolean;
  testResult: "success" | "error" | null;
  message: { type: "success" | "error"; text: string } | null;
  setMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
  handleTest: () => Promise<void>;
  handleSave: () => Promise<void>;
  apiKeyStored: boolean;
  loading: boolean;
  loadConfig: () => Promise<void>;
  handleReset: () => void;
  handleDeleteApiKey: () => Promise<void>;
}

export function useLlmSettings(
  options: UseLlmSettingsOptions = {}
): LlmSettingsState {
  const {
    defaultEndpoint = "",
    defaultModel = "",
    loadOnMount = false,
    testSuccessKey = "llmSettings.testSuccess",
    testErrorKey = "llmSettings.testError",
    saveSuccessKey = "llmSettings.saveSuccess",
    saveErrorKey = "llmSettings.saveError",
    loadErrorKey = "llmSettings.loadError",
    apiKeyDeletedKey = "llmSettings.apiKeyDeleted",
    deleteErrorKey = "common.error",
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
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [loading, setLoading] = useState(loadOnMount);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await invoke("load_llm_config");
      setEndpoint(config.llm_endpoint || defaultEndpoint);
      setModel(config.llm_model || defaultModel);
      setApiKeyStored(config.llm_api_key_stored);
      setApiKey("");
      setMessage(null);
    } catch (e) {
      setMessage({
        type: "error",
        text: t(loadErrorKey, {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setLoading(false);
    }
  }, [t, loadErrorKey, defaultEndpoint, defaultModel]);

  useEffect(() => {
    if (!loadOnMount) return;
    loadConfig();
  }, [loadOnMount, loadConfig]);

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
        llm_api_key_stored: apiKey ? true : apiKeyStored,
      };
      await invoke("save_llm_config", { llmConfig });

      if (apiKey) {
        await invoke("save_llm_api_key", { apiKey });
        setApiKeyStored(true);
        setApiKey("");
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
  }, [
    endpoint,
    model,
    apiKey,
    apiKeyStored,
    t,
    saveSuccessKey,
    saveErrorKey,
    onSaveSuccess,
  ]);

  const handleReset = useCallback(() => {
    setMessage(null);
    loadConfig();
  }, [loadConfig]);

  const handleDeleteApiKey = useCallback(async () => {
    try {
      setMessage(null);
      await invoke("delete_llm_api_key");
      setApiKeyStored(false);
      setApiKey("");
      setMessage({
        type: "success",
        text: t(apiKeyDeletedKey),
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: t(deleteErrorKey, {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    }
  }, [t, apiKeyDeletedKey, deleteErrorKey]);

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
    testing,
    testResult,
    message,
    setMessage,
    handleTest,
    handleSave,
    apiKeyStored,
    loading,
    loadConfig,
    handleReset,
    handleDeleteApiKey,
  };
}
