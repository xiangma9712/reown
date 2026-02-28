import { useTranslation } from "react-i18next";

interface OnboardingPlaceholderProps {
  onSkip: () => void;
}

export function OnboardingPlaceholder({ onSkip }: OnboardingPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-bg-primary">
      <h1 className="text-2xl font-bold text-text-primary">
        {t("onboarding.title")}
      </h1>
      <p className="text-text-secondary">{t("onboarding.placeholder")}</p>
      <button
        onClick={onSkip}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {t("onboarding.skip")}
      </button>
    </div>
  );
}
