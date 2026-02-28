import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Input } from "./Input";
import { Button } from "./Button";
import { invoke } from "../invoke";
import type { DeviceFlowResponse } from "../types";

type DeviceFlowState =
  | { status: "idle" }
  | { status: "polling"; response: DeviceFlowResponse }
  | { status: "success" }
  | { status: "error"; message: string };

interface SetupWizardStep2Props {
  onNext: () => void;
  onSkip: () => void;
}

export function SetupWizardStep2({ onNext, onSkip }: SetupWizardStep2Props) {
  const { t } = useTranslation();

  // Device Flow state
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({
    status: "idle",
  });
  const pollingRef = useRef(false);

  // Manual token state
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current = false;
    };
  }, []);

  const handleStartDeviceFlow = useCallback(async () => {
    try {
      setMessage(null);
      const response = await invoke("start_github_device_flow");
      setDeviceFlow({ status: "polling", response });
      pollingRef.current = true;

      // Start polling
      const startTime = Date.now();
      const expiresMs = response.expires_in * 1000;

      while (pollingRef.current) {
        await new Promise((resolve) =>
          setTimeout(resolve, response.interval * 1000)
        );
        if (!pollingRef.current) break;
        if (Date.now() - startTime > expiresMs) {
          pollingRef.current = false;
          setDeviceFlow({
            status: "error",
            message: t("onboarding.deviceFlowExpired"),
          });
          return;
        }
        try {
          await invoke("poll_github_device_flow", {
            deviceCode: response.device_code,
            interval: response.interval,
          });
          // Success — token was saved by the backend
          pollingRef.current = false;
          setDeviceFlow({ status: "success" });
          return;
        } catch {
          // authorization_pending — continue polling
        }
      }
    } catch (e) {
      pollingRef.current = false;
      setDeviceFlow({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [t]);

  const handleOpenBrowser = useCallback(() => {
    if (deviceFlow.status === "polling") {
      window.open(deviceFlow.response.verification_uri, "_blank");
    }
  }, [deviceFlow]);

  const handleSaveToken = useCallback(async () => {
    if (!token.trim()) return;
    try {
      setSaving(true);
      setMessage(null);
      await invoke("save_github_token", { token: token.trim() });
      setMessage({
        type: "success",
        text: t("onboarding.manualTokenSuccess"),
      });
      setToken("");
    } catch (e) {
      setMessage({
        type: "error",
        text: t("onboarding.manualTokenError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [token, t]);

  const isAuthenticated =
    deviceFlow.status === "success" || message?.type === "success";

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {t("onboarding.step2Title")}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t("onboarding.step2Description")}
          </p>
        </div>

        {/* Device Flow section */}
        <Card>
          <div className="space-y-4">
            {deviceFlow.status === "idle" && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleStartDeviceFlow}
              >
                {t("onboarding.deviceFlowStart")}
              </Button>
            )}

            {deviceFlow.status === "polling" && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-text-secondary">
                  {t("onboarding.deviceFlowInstruction")}
                </p>
                <div className="rounded-md bg-bg-primary px-4 py-3 font-mono text-2xl font-bold tracking-widest text-text-primary">
                  {deviceFlow.response.user_code}
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleOpenBrowser}
                >
                  {t("onboarding.deviceFlowOpenBrowser")}
                </Button>
                <p className="text-xs text-text-muted">
                  {t("onboarding.deviceFlowWaiting")}
                </p>
              </div>
            )}

            {deviceFlow.status === "success" && (
              <div className="rounded border border-success/30 bg-success/10 px-4 py-2 text-center text-sm text-success">
                {t("onboarding.deviceFlowSuccess")}
              </div>
            )}

            {deviceFlow.status === "error" && (
              <div className="space-y-3">
                <div className="rounded border border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm text-danger">
                  {t("onboarding.deviceFlowError", {
                    message: deviceFlow.message,
                  })}
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleStartDeviceFlow}
                >
                  {t("onboarding.deviceFlowStart")}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Manual token fallback */}
        {!isAuthenticated && (
          <Card>
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                {t("onboarding.manualTokenLabel")}
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={t("onboarding.manualTokenPlaceholder")}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken
                    ? t("onboarding.hideToken")
                    : t("onboarding.showToken")}
                </Button>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveToken}
                loading={saving}
                disabled={!token.trim()}
              >
                {saving
                  ? t("onboarding.manualTokenSaving")
                  : t("onboarding.manualTokenSave")}
              </Button>
            </div>
          </Card>
        )}

        {/* Message feedback (manual token) */}
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
          {isAuthenticated ? (
            <Button variant="primary" size="md" onClick={onNext}>
              {t("onboarding.next")}
            </Button>
          ) : (
            <p className="text-xs text-text-muted">
              {t("onboarding.skipNote")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
