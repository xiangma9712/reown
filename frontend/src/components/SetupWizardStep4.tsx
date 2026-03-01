import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface SetupWizardStep4Props {
  onComplete: () => void;
}

export function SetupWizardStep4({ onComplete }: SetupWizardStep4Props) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {t("onboarding.completeTitle")}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t("onboarding.completeDescription")}
          </p>
        </div>

        <div className="flex justify-center">
          <Button variant="primary" size="lg" onClick={onComplete}>
            {t("onboarding.completeButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
