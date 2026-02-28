import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FileDiff } from "../types";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Loading } from "./Loading";

function statusLabel(status: string): string {
  switch (status) {
    case "Added":
      return "A";
    case "Deleted":
      return "D";
    case "Modified":
      return "M";
    case "Renamed":
      return "R";
    default:
      return "?";
  }
}

function statusAriaLabel(status: string): string {
  switch (status) {
    case "Added":
      return "Added";
    case "Deleted":
      return "Deleted";
    case "Modified":
      return "Modified";
    case "Renamed":
      return "Renamed";
    default:
      return "Unknown";
  }
}

function statusVariant(
  status: string
): "success" | "danger" | "warning" | "info" | "default" {
  switch (status) {
    case "Added":
      return "success";
    case "Deleted":
      return "danger";
    case "Modified":
      return "warning";
    case "Renamed":
      return "info";
    default:
      return "default";
  }
}

function CollapseToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onToggle}
      className="shrink-0 cursor-pointer rounded border-none bg-transparent p-0.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={
        collapsed ? t("review.expandFileList") : t("review.collapseFileList")
      }
      title={
        collapsed ? t("review.expandFileList") : t("review.collapseFileList")
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {collapsed ? (
          <>
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </>
        ) : (
          <>
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </>
        )}
      </svg>
    </button>
  );
}

export interface FileListPanelProps {
  /** Title shown in the file list header */
  title: string;
  /** File diffs to display */
  files: FileDiff[];
  /** Index of currently selected file (-1 for none) */
  selectedIndex: number;
  /** Called when a file is clicked */
  onSelectFile: (index: number) => void;
  /** Whether the file list is loading */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Message shown when file list is empty */
  emptyMessage: string;
  /** Optional extra content to render after the status badge for each file */
  renderFileExtra?: (file: FileDiff, index: number) => ReactNode;
  /** Panel width, collapse, and resize state from useFileListPanel */
  fileListWidth: number;
  collapsed: boolean;
  resizing: boolean;
  onToggleCollapse: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  /** Content to display in the detail area (right side) */
  children: ReactNode;
}

export function FileListPanel({
  title,
  files,
  selectedIndex,
  onSelectFile,
  loading,
  error,
  emptyMessage,
  renderFileExtra,
  fileListWidth,
  collapsed,
  resizing,
  onToggleCollapse,
  onResizeStart,
  children,
}: FileListPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex min-h-[500px] gap-0${resizing ? " select-none" : ""}`}
    >
      {!collapsed && (
        <>
          <Card
            className="flex shrink-0 flex-col"
            style={{ width: fileListWidth }}
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg text-text-heading">{title}</h2>
              <CollapseToggleButton
                collapsed={false}
                onToggle={onToggleCollapse}
              />
            </div>
            <div className="scrollbar-custom flex-1 overflow-y-auto">
              {loading && <Loading />}
              {error && (
                <p className="p-2 text-[0.9rem] text-danger">
                  {t("common.error", { message: error })}
                </p>
              )}
              {!loading && !error && files.length === 0 && (
                <p className="p-2 text-[0.9rem] italic text-text-secondary">
                  {emptyMessage}
                </p>
              )}
              {files.map((diff, index) => (
                <div
                  key={diff.new_path ?? diff.old_path ?? index}
                  className={`flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 font-mono text-[0.8rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                    selectedIndex === index
                      ? "border-l-2 border-l-accent bg-bg-hover"
                      : ""
                  }`}
                  onClick={() => onSelectFile(index)}
                >
                  <Badge
                    variant={statusVariant(diff.status)}
                    className="status-badge"
                    aria-label={statusAriaLabel(diff.status)}
                  >
                    {statusLabel(diff.status)}
                  </Badge>
                  <span
                    className="min-w-0 flex-1 truncate text-text-primary"
                    title={diff.new_path ?? diff.old_path ?? ""}
                  >
                    {diff.new_path ?? diff.old_path ?? "(unknown)"}
                  </span>
                  {renderFileExtra?.(diff, index)}
                </div>
              ))}
            </div>
          </Card>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("review.resizeFileList")}
            className={`group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20 active:bg-accent/30 ${
              resizing ? "bg-accent/30" : ""
            }`}
            onMouseDown={onResizeStart}
          >
            <div
              className={`h-8 w-0.5 rounded-full bg-border group-hover:bg-accent/60 group-active:bg-accent ${
                resizing ? "bg-accent" : ""
              }`}
            />
          </div>
        </>
      )}
      {collapsed && (
        <div className="flex shrink-0 flex-col items-center gap-2 py-2 pr-2">
          <CollapseToggleButton collapsed={true} onToggle={onToggleCollapse} />
        </div>
      )}
      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-custom flex-1 overflow-auto">{children}</div>
      </Card>
    </div>
  );
}
