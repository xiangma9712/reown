import { useTranslation } from "react-i18next";
import { Dropdown } from "./Dropdown";

interface Props {
  branchName: string;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
}

export function BranchActionMenu({ branchName, onSwitch, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <Dropdown
      trigger={
        <button
          className="cursor-pointer rounded border border-border-hover bg-btn-secondary px-2 py-1 text-xs text-text-primary transition-colors hover:bg-btn-secondary-hover"
          aria-label={t("branch.actions", { name: branchName })}
        >
          ⋯
        </button>
      }
      items={[
        {
          label: t("branch.switch"),
          onSelect: () => onSwitch(branchName),
        },
        {
          label: t("common.delete"),
          onSelect: () => onDelete(branchName),
          variant: "danger",
        },
      ]}
    />
  );
}
