import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./Button";

interface Props {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, message, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg-secondary p-6 focus:outline-none">
          <Dialog.Title className="sr-only">
            {t("common.confirm")}
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-[0.95rem] text-text-primary">
            {message}
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            <Button variant="destructive" onClick={onConfirm}>
              {t("common.delete")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
