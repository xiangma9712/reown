import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Button } from "./Button";

interface SetupWizardStep1Props {
  onNext: () => void;
  onSkip: () => void;
}

export function SetupWizardStep1({ onNext, onSkip }: SetupWizardStep1Props) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {t("onboarding.step1Title")}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t("onboarding.step1Description")}
          </p>
        </div>

        <Card>
          <div className="py-8 text-center text-text-muted">
            {t("onboarding.step1Placeholder")}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="cursor-pointer border-none bg-transparent text-sm text-text-muted hover:text-text-secondary hover:underline"
            >
              {t("onboarding.skip")}
            </button>
            <Button variant="primary" size="md" onClick={onNext}>
              {t("onboarding.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
