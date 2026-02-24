import { createContext, useContext } from "react";

interface RepositoryContextValue {
  repoPath: string | null;
}

const RepositoryContext = createContext<RepositoryContextValue>({
  repoPath: null,
});

export function RepositoryProvider({
  repoPath,
  children,
}: {
  repoPath: string | null;
  children: React.ReactNode;
}) {
  return (
    <RepositoryContext.Provider value={{ repoPath }}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): RepositoryContextValue {
  return useContext(RepositoryContext);
}
