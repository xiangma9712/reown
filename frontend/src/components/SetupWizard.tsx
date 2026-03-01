import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SetupWizardStep1 } from "./SetupWizardStep1";
import { SetupWizardStep2 } from "./SetupWizardStep2";
import { SetupWizardStep3 } from "./SetupWizardStep3";
import { SetupWizardStep4 } from "./SetupWizardStep4";

const STEPS = ["repository", "github", "llm", "complete"] as const;
type Step = (typeof STEPS)[number];

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentStep: Step = STEPS[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex]);

  const renderStep = () => {
    switch (currentStep) {
      case "repository":
        return <SetupWizardStep1 onNext={handleNext} onSkip={handleNext} />;
      case "github":
        return <SetupWizardStep2 onNext={handleNext} onSkip={handleNext} />;
      case "llm":
        return <SetupWizardStep3 onNext={handleNext} onSkip={handleNext} />;
      case "complete":
        return <SetupWizardStep4 onComplete={onComplete} />;
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="fixed left-0 right-0 top-4 z-10 text-center text-sm text-text-muted">
        {t("onboarding.stepIndicator", {
          current: currentIndex + 1,
          total: STEPS.length,
        })}
      </div>

      {renderStep()}
    </div>
  );
}
