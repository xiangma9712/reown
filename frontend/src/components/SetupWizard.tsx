import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Card } from "./Card";

const STEPS = ["repository", "github", "llm", "complete"] as const;
type Step = (typeof STEPS)[number];

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentStep: Step = STEPS[currentIndex];
  const isComplete = currentStep === "complete";

  const handleNext = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleSkip = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex]);

  const stepTitle = (step: Step): string => {
    switch (step) {
      case "repository":
        return t("onboarding.step1Title");
      case "github":
        return t("onboarding.step2Title");
      case "llm":
        return t("onboarding.step3Title");
      case "complete":
        return t("onboarding.completeTitle");
    }
  };

  const stepDescription = (step: Step): string => {
    switch (step) {
      case "repository":
        return t("onboarding.step1Description");
      case "github":
        return t("onboarding.step2Description");
      case "llm":
        return t("onboarding.step3Description");
      case "complete":
        return t("onboarding.completeDescription");
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-6 px-4">
        {/* Step indicator */}
        <div className="text-center text-sm text-text-muted">
          {t("onboarding.stepIndicator", {
            current: currentIndex + 1,
            total: STEPS.length,
          })}
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {stepTitle(currentStep)}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {stepDescription(currentStep)}
          </p>
        </div>

        {/* Step content */}
        {!isComplete && (
          <Card>
            <div className="py-8 text-center text-text-muted">
              {stepTitle(currentStep)}
            </div>
          </Card>
        )}

        {/* Navigation */}
        {isComplete ? (
          <div className="flex justify-center">
            <Button variant="primary" size="lg" onClick={onComplete}>
              {t("onboarding.completeButton")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              {currentIndex > 0 ? (
                <Button variant="ghost" size="md" onClick={handleBack}>
                  {t("onboarding.back")}
                </Button>
              ) : (
                <div />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="cursor-pointer border-none bg-transparent text-sm text-text-muted hover:text-text-secondary hover:underline"
              >
                {t("onboarding.skip")}
              </button>
              <Button variant="primary" size="md" onClick={handleNext}>
                {t("onboarding.next")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
