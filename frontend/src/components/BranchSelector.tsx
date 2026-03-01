import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type { EnrichedBranchInfo, PrInfo } from "../types";
import { Badge } from "./Badge";

interface Props {
  prs: PrInfo[];
  selectedBranch: string | null;
  onSelectBranch: (branchName: string) => void;
}

export function BranchSelector({ prs, selectedBranch, onSelectBranch }: Props) {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [branches, setBranches] = useState<EnrichedBranchInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadBranches = useCallback(async () => {
    if (!repoPath) return;
    try {
      const result = await invoke("list_enriched_branches", {
        repoPath,
        pullRequests: prs,
      });
      setBranches(result);
    } catch {
      // silently ignore — branches may not be available yet
    }
  }, [repoPath, prs]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Auto-select HEAD branch when no branch is selected
  useEffect(() => {
    if (!selectedBranch && branches.length > 0) {
      const head = branches.find((b) => b.is_head);
      if (head) {
        onSelectBranch(head.name);
      }
    }
  }, [branches, selectedBranch, onSelectBranch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, search]);

  const selectedInfo = useMemo(
    () => branches.find((b) => b.name === selectedBranch),
    [branches, selectedBranch]
  );

  function handleSelect(name: string) {
    onSelectBranch(name);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex max-w-[220px] cursor-pointer items-center gap-1.5 rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-accent hover:text-accent"
          title={selectedBranch ?? ""}
        >
          <span className="truncate font-mono">
            {selectedBranch ?? t("branchSelector.placeholder")}
          </span>
          {selectedInfo?.is_head && (
            <span className="text-xs text-accent">*</span>
          )}
          <svg
            className="ml-auto h-3 w-3 shrink-0 text-text-muted"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[300px] rounded-lg border border-border bg-bg-primary shadow-lg"
          sideOffset={4}
          align="start"
        >
          <div className="border-b border-border p-2">
            <input
              className="w-full rounded border border-border bg-bg-primary px-2 py-1 font-mono text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              placeholder={t("branchSelector.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="scrollbar-custom max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">
                {t("branchSelector.empty")}
              </p>
            ) : (
              filtered.map((b) => (
                <button
                  key={b.name}
                  className={`flex w-full cursor-pointer items-center gap-2 border-none px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover ${
                    b.name === selectedBranch
                      ? "bg-bg-hover text-accent"
                      : "bg-transparent text-text-primary"
                  }`}
                  onClick={() => handleSelect(b.name)}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {b.is_head ? `* ${b.name}` : b.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {b.is_local && (
                      <Badge variant="default">
                        {t("branchSelector.local")}
                      </Badge>
                    )}
                    {b.is_remote && (
                      <Badge variant="info">{t("branchSelector.remote")}</Badge>
                    )}
                    {b.has_worktree && (
                      <Badge variant="warning">
                        {t("branchSelector.worktree")}
                      </Badge>
                    )}
                    {b.pr_number != null && (
                      <Badge variant="accent">
                        {t("branchSelector.pr")} #{b.pr_number}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
