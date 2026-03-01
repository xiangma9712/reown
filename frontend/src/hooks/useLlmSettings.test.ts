import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLlmSettings } from "./useLlmSettings";
import type { Commands } from "../invoke";
import type { LlmConfig } from "../types";

vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

type MockInvoke = <C extends keyof Commands>(
  command: C,
  ...rest: Commands[C]["args"] extends Record<string, unknown> | undefined
    ? [args?: Commands[C]["args"]]
    : [args: Commands[C]["args"]]
) => Promise<Commands[C]["ret"]>;

const mockInvokeFn = vi.fn<MockInvoke>();

vi.mock("../invoke", () => ({
  invoke: (...args: unknown[]) =>
    (mockInvokeFn as (...a: unknown[]) => unknown)(...args),
}));

const validConfig: LlmConfig = {
  llm_endpoint: "https://api.anthropic.com",
  llm_model: "claude-sonnet-4-5-20250929",
  llm_api_key_stored: true,
};

describe("useLlmSettings – loadOnMount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call load_llm_config when loadOnMount is false", () => {
    renderHook(() => useLlmSettings({ loadOnMount: false }));
    expect(mockInvokeFn).not.toHaveBeenCalled();
  });

  it("does not call load_llm_config when loadOnMount is omitted", () => {
    renderHook(() => useLlmSettings());
    expect(mockInvokeFn).not.toHaveBeenCalled();
  });

  it("calls load_llm_config on mount when loadOnMount is true", async () => {
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    renderHook(() => useLlmSettings({ loadOnMount: true }));

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith("load_llm_config");
    });
  });

  it("reflects loaded config in state", async () => {
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    const { result } = renderHook(() => useLlmSettings({ loadOnMount: true }));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBe("https://api.anthropic.com");
    expect(result.current.model).toBe("claude-sonnet-4-5-20250929");
    expect(result.current.apiKeyStored).toBe(true);
    expect(result.current.apiKey).toBe("");
    expect(result.current.message).toBeNull();
  });

  it("uses default values for empty config fields", async () => {
    const emptyConfig: LlmConfig = {
      llm_endpoint: "",
      llm_model: "",
      llm_api_key_stored: false,
    };
    mockInvokeFn.mockResolvedValueOnce(emptyConfig);

    const { result } = renderHook(() =>
      useLlmSettings({
        loadOnMount: true,
        defaultEndpoint: "https://default.endpoint.com",
        defaultModel: "default-model",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBe("https://default.endpoint.com");
    expect(result.current.model).toBe("default-model");
    expect(result.current.apiKeyStored).toBe(false);
  });

  it("maintains default values on load error", async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useLlmSettings({
        loadOnMount: true,
        defaultEndpoint: "https://fallback.com",
        defaultModel: "fallback-model",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Defaults are maintained
    expect(result.current.endpoint).toBe("https://fallback.com");
    expect(result.current.model).toBe("fallback-model");
    expect(result.current.apiKeyStored).toBe(false);
    expect(result.current.apiKey).toBe("");

    // Error message is set
    expect(result.current.message).not.toBeNull();
    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("Network error");
  });

  it("maintains default values on load error with non-Error rejection", async () => {
    mockInvokeFn.mockRejectedValueOnce("string error");

    const { result } = renderHook(() =>
      useLlmSettings({
        loadOnMount: true,
        defaultEndpoint: "https://fallback.com",
        defaultModel: "fallback-model",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBe("https://fallback.com");
    expect(result.current.model).toBe("fallback-model");
    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("string error");
  });

  it("can reload config via loadConfig", async () => {
    // First mount load
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    const { result } = renderHook(() => useLlmSettings({ loadOnMount: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBe("https://api.anthropic.com");

    // Reload with different config
    const updatedConfig: LlmConfig = {
      llm_endpoint: "https://updated.api.com",
      llm_model: "updated-model",
      llm_api_key_stored: false,
    };
    mockInvokeFn.mockResolvedValueOnce(updatedConfig);

    await act(async () => {
      await result.current.loadConfig();
    });

    expect(result.current.endpoint).toBe("https://updated.api.com");
    expect(result.current.model).toBe("updated-model");
    expect(result.current.apiKeyStored).toBe(false);
  });
});

describe("useLlmSettings – handleSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves config without API key", async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined); // save_llm_config

    const { result } = renderHook(() =>
      useLlmSettings({
        defaultEndpoint: "https://api.example.com",
        defaultModel: "test-model",
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_config", {
      llmConfig: {
        llm_endpoint: "https://api.example.com",
        llm_model: "test-model",
        llm_api_key_stored: false,
      },
    });
    expect(mockInvokeFn).not.toHaveBeenCalledWith(
      "save_llm_api_key",
      expect.anything()
    );
    expect(result.current.saving).toBe(false);
    expect(result.current.message?.type).toBe("success");
  });

  it("saves config and API key when apiKey is set", async () => {
    mockInvokeFn
      .mockResolvedValueOnce(undefined) // save_llm_config
      .mockResolvedValueOnce(undefined); // save_llm_api_key

    const { result } = renderHook(() =>
      useLlmSettings({
        defaultEndpoint: "https://api.example.com",
        defaultModel: "test-model",
      })
    );

    // Set an API key
    act(() => {
      result.current.setApiKey("sk-test-key");
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_config", {
      llmConfig: {
        llm_endpoint: "https://api.example.com",
        llm_model: "test-model",
        llm_api_key_stored: true,
      },
    });
    expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_api_key", {
      apiKey: "sk-test-key",
    });
    expect(result.current.apiKeyStored).toBe(true);
    expect(result.current.apiKey).toBe("");
    expect(result.current.message?.type).toBe("success");
  });

  it("sets saving flag during save", async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    mockInvokeFn.mockReturnValueOnce(savePromise);

    const { result } = renderHook(() => useLlmSettings());

    // Start save (don't await)
    let saveFinished = false;
    act(() => {
      result.current.handleSave().then(() => {
        saveFinished = true;
      });
    });

    // saving should be true while in progress
    expect(result.current.saving).toBe(true);

    // Resolve save
    await act(async () => {
      resolveSave!();
    });

    await waitFor(() => {
      expect(saveFinished).toBe(true);
    });
    expect(result.current.saving).toBe(false);
  });

  it("shows error message on save failure", async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error("Save failed"));

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("Save failed");
  });

  it("shows error message on save failure with non-Error rejection", async () => {
    mockInvokeFn.mockRejectedValueOnce("string save error");

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("string save error");
  });

  it("calls onSaveSuccess callback after successful save", async () => {
    const onSaveSuccess = vi.fn();
    mockInvokeFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLlmSettings({ onSaveSuccess }));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it("does not call onSaveSuccess on save failure", async () => {
    const onSaveSuccess = vi.fn();
    mockInvokeFn.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useLlmSettings({ onSaveSuccess }));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSaveSuccess).not.toHaveBeenCalled();
  });

  it("preserves apiKeyStored when saving without new API key", async () => {
    // Load config with apiKeyStored=true
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    const { result } = renderHook(() => useLlmSettings({ loadOnMount: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.apiKeyStored).toBe(true);

    // Save without setting a new API key
    mockInvokeFn.mockResolvedValueOnce(undefined); // save_llm_config

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_config", {
      llmConfig: {
        llm_endpoint: "https://api.anthropic.com",
        llm_model: "claude-sonnet-4-5-20250929",
        llm_api_key_stored: true,
      },
    });
  });
});

describe("useLlmSettings – handleTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls test_llm_connection with current values", async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useLlmSettings({
        defaultEndpoint: "https://api.example.com",
        defaultModel: "test-model",
      })
    );

    await act(async () => {
      await result.current.handleTest();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("test_llm_connection", {
      endpoint: "https://api.example.com",
      model: "test-model",
      apiKey: undefined,
    });
  });

  it("passes apiKey when set", async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useLlmSettings({
        defaultEndpoint: "https://api.example.com",
        defaultModel: "test-model",
      })
    );

    act(() => {
      result.current.setApiKey("sk-test-key");
    });

    await act(async () => {
      await result.current.handleTest();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("test_llm_connection", {
      endpoint: "https://api.example.com",
      model: "test-model",
      apiKey: "sk-test-key",
    });
  });

  it("sets testResult to success on successful test", async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleTest();
    });

    expect(result.current.testResult).toBe("success");
    expect(result.current.message?.type).toBe("success");
    expect(result.current.testing).toBe(false);
  });

  it("sets testResult to error on test failure", async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error("Connection refused"));

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleTest();
    });

    expect(result.current.testResult).toBe("error");
    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("Connection refused");
    expect(result.current.testing).toBe(false);
  });

  it("sets testing flag during test", async () => {
    let resolveTest: () => void;
    const testPromise = new Promise<void>((resolve) => {
      resolveTest = resolve;
    });
    mockInvokeFn.mockReturnValueOnce(testPromise);

    const { result } = renderHook(() => useLlmSettings());

    let testFinished = false;
    act(() => {
      result.current.handleTest().then(() => {
        testFinished = true;
      });
    });

    expect(result.current.testing).toBe(true);

    await act(async () => {
      resolveTest!();
    });

    await waitFor(() => {
      expect(testFinished).toBe(true);
    });
    expect(result.current.testing).toBe(false);
  });

  it("clears previous message and testResult before testing", async () => {
    // First test fails
    mockInvokeFn.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleTest();
    });

    expect(result.current.testResult).toBe("error");
    expect(result.current.message?.type).toBe("error");

    // Second test succeeds — previous state should be cleared
    mockInvokeFn.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.handleTest();
    });

    expect(result.current.testResult).toBe("success");
    expect(result.current.message?.type).toBe("success");
  });

  it("handles non-Error rejection in test", async () => {
    mockInvokeFn.mockRejectedValueOnce("string test error");

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleTest();
    });

    expect(result.current.testResult).toBe("error");
    expect(result.current.message?.text).toContain("string test error");
  });
});

describe("useLlmSettings – handleDeleteApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes API key successfully", async () => {
    // Load config with stored key
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    const { result } = renderHook(() => useLlmSettings({ loadOnMount: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.apiKeyStored).toBe(true);

    // Delete API key
    mockInvokeFn.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.handleDeleteApiKey();
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("delete_llm_api_key");
    expect(result.current.apiKeyStored).toBe(false);
    expect(result.current.apiKey).toBe("");
    expect(result.current.message?.type).toBe("success");
  });

  it("shows error message on delete failure", async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleDeleteApiKey();
    });

    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("Delete failed");
  });

  it("handles non-Error rejection in delete", async () => {
    mockInvokeFn.mockRejectedValueOnce("string delete error");

    const { result } = renderHook(() => useLlmSettings());

    await act(async () => {
      await result.current.handleDeleteApiKey();
    });

    expect(result.current.message?.type).toBe("error");
    expect(result.current.message?.text).toContain("string delete error");
  });

  it("clears previous message before delete", async () => {
    // Set a message first
    const { result } = renderHook(() => useLlmSettings());

    act(() => {
      result.current.setMessage({ type: "success", text: "previous message" });
    });

    expect(result.current.message).not.toBeNull();

    // Delete (will fail, but message should be cleared first)
    mockInvokeFn.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.handleDeleteApiKey();
    });

    // Message is now the success from delete, not the previous one
    expect(result.current.message?.text).not.toBe("previous message");
  });
});

describe("useLlmSettings – handleReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears message and reloads config", async () => {
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    const { result } = renderHook(() => useLlmSettings());

    // Set a message
    act(() => {
      result.current.setMessage({ type: "error", text: "some error" });
    });

    expect(result.current.message).not.toBeNull();

    // Reset
    await act(async () => {
      result.current.handleReset();
    });

    // Message is cleared immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockInvokeFn).toHaveBeenCalledWith("load_llm_config");
  });

  it("restores values from backend after reset", async () => {
    const { result } = renderHook(() =>
      useLlmSettings({
        defaultEndpoint: "https://default.com",
        defaultModel: "default-model",
      })
    );

    // Modify values
    act(() => {
      result.current.setEndpoint("https://modified.com");
      result.current.setModel("modified-model");
    });

    expect(result.current.endpoint).toBe("https://modified.com");

    // Reset — backend returns config
    mockInvokeFn.mockResolvedValueOnce(validConfig);

    await act(async () => {
      result.current.handleReset();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBe("https://api.anthropic.com");
    expect(result.current.model).toBe("claude-sonnet-4-5-20250929");
  });
});

describe("useLlmSettings – toggleShowApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles showApiKey from false to true", () => {
    const { result } = renderHook(() => useLlmSettings());

    expect(result.current.showApiKey).toBe(false);

    act(() => {
      result.current.toggleShowApiKey();
    });

    expect(result.current.showApiKey).toBe(true);
  });

  it("toggles showApiKey back to false", () => {
    const { result } = renderHook(() => useLlmSettings());

    act(() => {
      result.current.toggleShowApiKey();
    });

    expect(result.current.showApiKey).toBe(true);

    act(() => {
      result.current.toggleShowApiKey();
    });

    expect(result.current.showApiKey).toBe(false);
  });
});
