import { createContext, useContext } from "react";
import type { RepoInfo } from "./types";

interface RepositoryContextValue {
  repoPath: string | null;
  repoInfo: RepoInfo | null;
}

const RepositoryContext = createContext<RepositoryContextValue>({
  repoPath: null,
  repoInfo: null,
});

export function RepositoryProvider({
  repoPath,
  repoInfo,
  children,
}: {
  repoPath: string | null;
  repoInfo: RepoInfo | null;
  children: React.ReactNode;
}) {
  return (
    <RepositoryContext.Provider value={{ repoPath, repoInfo }}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): RepositoryContextValue {
  return useContext(RepositoryContext);
}
