import { useTranslation } from "react-i18next";
import type { AutoMergeStatus } from "../types";
import { Badge } from "./Badge";

interface AutoMergeBadgeProps {
  status: AutoMergeStatus | null;
  className?: string;
}

function getVariant(status: AutoMergeStatus): "success" | "danger" | "default" {
  if (status === "Enabled") return "success";
  if (typeof status === "object" && "Failed" in status) return "danger";
  return "default";
}

function getLabelKey(status: AutoMergeStatus): string {
  if (status === "Enabled") return "pr.autoApproveMergeEnabled";
  if (typeof status === "object" && "Failed" in status)
    return "pr.autoApproveMergeFailed";
  return "pr.autoApproveMergeSkipped";
}

export function AutoMergeBadge({ status, className }: AutoMergeBadgeProps) {
  const { t } = useTranslation();

  if (status === null) return null;

  return (
    <Badge variant={getVariant(status)} className={className}>
      {t(getLabelKey(status))}
    </Badge>
  );
}
