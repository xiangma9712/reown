import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { invoke } from "../invoke";
import type { DeviceFlowResponse } from "../types";
import { Button } from "./Button";
import { Loading } from "./Loading";

export interface DeviceFlowDialogProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  initialDeviceFlow?: DeviceFlowResponse;
}

export function DeviceFlowDialog({
  open,
  onClose,
  onAuthenticated,
  initialDeviceFlow,
}: DeviceFlowDialogProps) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<DeviceFlowResponse | null>(
    initialDeviceFlow ?? null
  );
  const [status, setStatus] = useState<"idle" | "polling" | "success" | "error">(
    initialDeviceFlow ? "polling" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startFlow = useCallback(async () => {
    setStatus("idle");
    setErrorMessage(null);
    setCopied(false);
    try {
      const res = await invoke("start_github_device_flow");
      setFlow(res);
      setStatus("polling");
    } catch (err) {
      setStatus("error");
      setErrorMessage(String(err));
    }
  }, []);

  useEffect(() => {
    if (open && !initialDeviceFlow && status === "idle") {
      startFlow();
    }
  }, [open, initialDeviceFlow, status, startFlow]);

  useEffect(() => {
    if (!open || status !== "polling" || !flow) return;

    let cancelled = false;

    const poll = async () => {
      try {
        await invoke("poll_github_device_flow", {
          deviceCode: flow.device_code,
          interval: flow.interval,
        });
        if (!cancelled) {
          setStatus("success");
          setTimeout(() => {
            if (!cancelled) {
              onAuthenticated();
            }
          }, 1500);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(String(err));
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [open, status, flow, onAuthenticated]);

  const handleCopyCode = async () => {
    if (!flow) return;
    try {
      await navigator.clipboard.writeText(flow.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenUri = () => {
    if (!flow) return;
    window.open(flow.verification_uri, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg-primary p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="text-xl font-bold text-text-primary">
            {t("deviceFlow.title", "GitHub Device Flow 認証")}
          </Dialog.Title>

          {status === "idle" && (
            <div className="my-8 flex flex-col items-center justify-center">
              <Loading text={t("deviceFlow.initializing", "認証コードを取得中...")} />
            </div>
          )}

          {status === "polling" && flow && (
            <div className="my-6 space-y-5">
              <p className="text-sm text-text-muted">
                {t(
                  "deviceFlow.instructions",
                  "以下のユーザーコードをコピーし、GitHub認証画面で入力してください。"
                )}
              </p>

              <div className="flex flex-col items-center rounded-lg border border-border bg-bg-hover p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t("deviceFlow.userCodeLabel", "User Code")}
                </span>
                <span className="my-2 font-mono text-3xl font-extrabold tracking-widest text-accent">
                  {flow.user_code}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyCode}
                  data-testid="copy-user-code-button"
                >
                  {copied
                    ? t("common.copied", "コピーしました！")
                    : t("common.copy", "コードをコピー")}
                </Button>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2">
                <Button variant="primary" size="lg" onClick={handleOpenUri}>
                  {t("deviceFlow.openBrowser", "GitHub認証画面を開く")}
                </Button>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Loading size="sm" />
                  <span>
                    {t("deviceFlow.waitingAuthorization", "ユーザーの認証完了を待機中...")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="my-8 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                {t("deviceFlow.successTitle", "認証が完了しました！")}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {t("deviceFlow.successDescription", "GitHubアカウントと連携されました。")}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="my-6 space-y-4">
              <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                <p className="font-semibold">
                  {t("deviceFlow.errorTitle", "認証に失敗しました")}
                </p>
                <p className="mt-1 text-xs">{errorMessage}</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={onClose}>
                  {t("common.close", "閉じる")}
                </Button>
                <Button variant="primary" onClick={startFlow}>
                  {t("common.retry", "再試行")}
                </Button>
              </div>
            </div>
          )}

          {status !== "error" && (
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button variant="secondary" onClick={onClose}>
                  {t("common.cancel", "キャンセル")}
                </Button>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
