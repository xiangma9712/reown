import { useTranslation } from "react-i18next";
import { Card } from "./Card";

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function KeyboardShortcutSettingsTab({ enabled, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-heading">
          {t("keyboardShortcuts.label")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("keyboardShortcuts.description")}
        </p>
      </div>

      <Card>
        <div
          className="flex items-center gap-1 rounded border border-border p-0.5"
          role="radiogroup"
          aria-label={t("keyboardShortcuts.label")}
        >
          <button
            role="radio"
            aria-checked={!enabled}
            onClick={() => onChange(false)}
            className={`flex-1 cursor-pointer rounded border-none px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              !enabled
                ? "bg-accent text-white"
                : "bg-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t("keyboardShortcuts.hide")}
          </button>
          <button
            role="radio"
            aria-checked={enabled}
            onClick={() => onChange(true)}
            className={`flex-1 cursor-pointer rounded border-none px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              enabled
                ? "bg-accent text-white"
                : "bg-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t("keyboardShortcuts.show")}
          </button>
        </div>
      </Card>
    </div>
  );
}
