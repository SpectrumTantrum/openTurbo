import type { ReactNode } from "react";

export interface StudyWorkspaceProps {
  children: ReactNode;
}

// Focused full-page study workspace container. Currently a passthrough wrapper that
// gives the 3-pane Library view a stable name for future expansion.
export function StudyWorkspace({ children }: StudyWorkspaceProps) {
  return <>{children}</>;
}
