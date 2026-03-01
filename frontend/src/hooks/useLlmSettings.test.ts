import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLlmSettings } from "./useLlmSettings";

vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

const mockInvokeFn = vi.fn();

vi.mock("../invoke", () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}));

const validConfig = {
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
    mockInvokeFn.mockResolvedValueOnce({
      llm_endpoint: "",
      llm_model: "",
      llm_api_key_stored: false,
    });

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
    mockInvokeFn.mockResolvedValueOnce({
      llm_endpoint: "https://updated.api.com",
      llm_model: "updated-model",
      llm_api_key_stored: false,
    });

    await act(async () => {
      await result.current.loadConfig();
    });

    expect(result.current.endpoint).toBe("https://updated.api.com");
    expect(result.current.model).toBe("updated-model");
    expect(result.current.apiKeyStored).toBe(false);
  });
});
