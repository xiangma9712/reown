import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./Button";

const WarningIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-6 shrink-0 text-danger"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.499-2.599 4.499H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.004ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
      clipRule="evenodd"
    />
  </svg>
);

interface Props {
  open: boolean;
  message: string;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "primary";
}

export function ConfirmDialog({
  open,
  message,
  children,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmVariant = "destructive",
}: Props) {
  const { t } = useTranslation();
  const isDestructive = confirmVariant === "destructive";

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg-primary p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="sr-only">{t("common.confirm")}</Dialog.Title>
          <div className="mb-5 flex gap-3">
            {isDestructive && <WarningIcon />}
            <Dialog.Description className="text-lg text-text-primary">
              {message}
            </Dialog.Description>
          </div>
          {children}
          <div className="flex justify-end gap-4">
            <Dialog.Close asChild>
              <Button variant="secondary" size="lg" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            <Button variant={confirmVariant} size="lg" onClick={onConfirm}>
              {confirmLabel ?? t("common.delete")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
