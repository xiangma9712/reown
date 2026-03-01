import { useCallback, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { useTheme, type Theme } from "../ThemeContext";

const THEME_OPTIONS: Theme[] = ["light", "dark", "system"];

export function ThemeSettingsTab() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = THEME_OPTIONS.indexOf(theme);
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex =
          (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextTheme = THEME_OPTIONS[nextIndex];
        setTheme(nextTheme);
        const group = e.currentTarget;
        const buttons =
          group.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons[nextIndex]?.focus();
      }
    },
    [theme, setTheme]
  );

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
          onKeyDown={handleKeyDown}
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={theme === option}
              tabIndex={theme === option ? 0 : -1}
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
