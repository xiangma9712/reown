import { useTranslation } from "react-i18next";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[90%] max-w-[400px] rounded-lg border border-border bg-bg-secondary p-6">
        <p className="mb-5 text-[0.95rem] text-text-primary">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border-none bg-btn-secondary px-3 py-1.5 text-[0.8rem] text-text-primary transition-colors hover:bg-btn-secondary-hover"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            className="cursor-pointer rounded border-none bg-danger px-3 py-1.5 text-[0.8rem] font-semibold text-white transition-colors hover:bg-danger-hover"
            onClick={onConfirm}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
