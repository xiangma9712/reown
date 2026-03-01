import { useTranslation } from "react-i18next";
import type { RiskLevel } from "../types";
import { Badge } from "./Badge";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const riskConfig: Record<
  RiskLevel,
  { variant: "success" | "warning" | "danger"; labelKey: string }
> = {
  Low: { variant: "success", labelKey: "pr.riskLow" },
  Medium: { variant: "warning", labelKey: "pr.riskMedium" },
  High: { variant: "danger", labelKey: "pr.riskHigh" },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { t } = useTranslation();
  const config = riskConfig[level];

  return (
    <Badge variant={config.variant} className={className}>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-current" />
        {t(config.labelKey)}
      </span>
    </Badge>
  );
}
