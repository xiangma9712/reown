import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardTitle } from "./Card";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  onRerun: () => void;
}

export function RerunWizardSection({ onRerun }: Props) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onRerun();
  };

  return (
    <Card>
      <CardTitle weight="bold">{t("settings.rerunWizardTitle", "セットアップウィザード")}</CardTitle>
      <p className="mt-1 text-sm text-text-muted">
        {t(
          "settings.rerunWizardDescription",
          "初期セットアップウィザードを再度表示し、設定をやり直します。"
        )}
      </p>
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => setConfirmOpen(true)}
          data-testid="rerun-wizard-button"
        >
          {t("settings.rerunWizardButton", "セットアップウィザードを再実行")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        message={t(
          "settings.rerunWizardConfirmMessage",
          "セットアップウィザードを再実行しますか？"
        )}
        confirmLabel={t("settings.rerunWizardConfirmButton", "再実行")}
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
