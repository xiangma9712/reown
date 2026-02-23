import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface Props {
  branchName: string;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
}

export function BranchActionMenu({ branchName, onSwitch, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="cursor-pointer rounded border border-border-hover bg-btn-secondary px-2 py-1 text-xs text-text-primary transition-colors hover:bg-btn-secondary-hover"
          aria-label={t("branch.actions", { name: branchName })}
        >
          ⋯
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] rounded-lg border border-border bg-bg-secondary p-1 shadow-lg"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-1.5 text-[0.8rem] text-text-primary outline-none transition-colors hover:bg-bg-hover focus:bg-bg-hover"
            onSelect={() => onSwitch(branchName)}
          >
            {t("branch.switch")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-1.5 text-[0.8rem] font-semibold text-danger outline-none transition-colors hover:bg-bg-hover focus:bg-bg-hover"
            onSelect={() => onDelete(branchName)}
          >
            {t("common.delete")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
