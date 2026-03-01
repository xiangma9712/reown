import { useTranslation } from "react-i18next";

export function FileDiffLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 text-[0.75rem] text-text-secondary">
      <span>{t("pr.fileDiffLegend")}</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <span>+ {t("pr.fileDiffLegendAdditions")}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-danger" />
        <span>- {t("pr.fileDiffLegendDeletions")}</span>
      </span>
    </div>
  );
}
