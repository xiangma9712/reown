import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { useTheme, type Theme } from "../ThemeContext";

const THEME_OPTIONS: Theme[] = ["light", "dark", "system"];

export function ThemeSettingsTab() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-heading">
          {t("theme.label")}
        </h2>
      </div>

      <Card>
        <div
          className="flex items-center gap-1 rounded border border-border p-0.5"
          role="radiogroup"
          aria-label={t("theme.label")}
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={theme === option}
              onClick={() => setTheme(option)}
              className={`flex-1 cursor-pointer rounded border-none px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                theme === option
                  ? "bg-accent text-white"
                  : "bg-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {t(`theme.${option}`)}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
