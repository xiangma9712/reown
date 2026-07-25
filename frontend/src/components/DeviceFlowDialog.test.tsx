import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeviceFlowDialog } from "./DeviceFlowDialog";

vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

const mockFlow = {
  device_code: "dc_test_123",
  user_code: "WXYZ-9876",
  verification_uri: "https://github.com/login/device",
  interval: 5,
  expires_in: 900,
};

vi.mock("../invoke", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "start_github_device_flow") {
      return Promise.resolve(mockFlow);
    }
    if (cmd === "poll_github_device_flow") {
      return Promise.resolve();
    }
    return Promise.resolve(null);
  }),
}));

describe("DeviceFlowDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user code and copy button when open", async () => {
    render(
      <DeviceFlowDialog
        open={true}
        onClose={vi.fn()}
        onAuthenticated={vi.fn()}
        initialDeviceFlow={mockFlow}
      />
    );

    expect(screen.getByText("WXYZ-9876")).toBeInTheDocument();
    expect(screen.getByTestId("copy-user-code-button")).toBeInTheDocument();
  });
});
