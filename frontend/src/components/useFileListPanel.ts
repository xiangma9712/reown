import { useState, useEffect, useCallback, useRef } from "react";

const FILE_LIST_WIDTH_KEY = "reown-filelist-width";
const FILE_LIST_COLLAPSED_KEY = "reown-filelist-collapsed";
const DEFAULT_FILE_LIST_WIDTH = 280;
const MIN_FILE_LIST_WIDTH = 180;
const MAX_FILE_LIST_WIDTH = 480;

export function useFileListPanel() {
  const [fileListWidth, setFileListWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(FILE_LIST_WIDTH_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= MIN_FILE_LIST_WIDTH && parsed <= MAX_FILE_LIST_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_FILE_LIST_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(FILE_LIST_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FILE_LIST_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: fileListWidth };
      setResizing(true);
    },
    [fileListWidth]
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(
        MAX_FILE_LIST_WIDTH,
        Math.max(MIN_FILE_LIST_WIDTH, resizeRef.current.startWidth + delta)
      );
      setFileListWidth(newWidth);
    };

    const handleMouseUp = () => {
      setResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Persist width when resizing ends
  const prevResizingRef = useRef(false);
  useEffect(() => {
    if (prevResizingRef.current && !resizing) {
      try {
        localStorage.setItem(FILE_LIST_WIDTH_KEY, String(fileListWidth));
      } catch {
        // ignore
      }
    }
    prevResizingRef.current = resizing;
  }, [resizing, fileListWidth]);

  return {
    fileListWidth,
    collapsed,
    resizing,
    toggleCollapse,
    handleResizeStart,
  };
}
