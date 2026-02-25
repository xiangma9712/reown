/**
 * Storybook用 RepositoryContext モックプロバイダー。
 */
import type { ReactNode } from "react";
import { RepositoryProvider } from "../RepositoryContext";
import type { RepoInfo } from "../types";
import { fixtures } from "./fixtures";

interface MockRepositoryProviderProps {
  children: ReactNode;
  repoPath?: string | null;
  repoInfo?: RepoInfo | null;
}

/**
 * Storybook ストーリーで RepositoryContext を提供するラッパー。
 *
 * @example
 * ```tsx
 * <MockRepositoryProvider>
 *   <BranchTab />
 * </MockRepositoryProvider>
 * ```
 */
export function MockRepositoryProvider({
  children,
  repoPath = fixtures.repoInfo.path,
  repoInfo = fixtures.repoInfo,
}: MockRepositoryProviderProps) {
  return (
    <RepositoryProvider repoPath={repoPath} repoInfo={repoInfo}>
      {children}
    </RepositoryProvider>
  );
}
