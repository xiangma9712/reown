import { useTranslation } from "react-i18next";
import type { RiskLevel } from "../types";
import { Badge } from "./Badge";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const riskConfig: Record<RiskLevel, { variant: "success" | "warning" | "danger"; emoji: string; labelKey: string }> = {
  Low: { variant: "success", emoji: "\uD83D\uDFE2", labelKey: "pr.riskLow" },
  Medium: { variant: "warning", emoji: "\uD83D\uDFE1", labelKey: "pr.riskMedium" },
  High: { variant: "danger", emoji: "\uD83D\uDD34", labelKey: "pr.riskHigh" },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { t } = useTranslation();
  const config = riskConfig[level];

  return (
    <Badge variant={config.variant} className={className}>
      {config.emoji} {t(config.labelKey)}
    </Badge>
  );
}
