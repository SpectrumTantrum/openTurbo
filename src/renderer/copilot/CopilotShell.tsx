import { type ReactNode, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { openTurboCopilotCatalog } from "./copilotCatalog.js";

export interface CopilotShellProps {
  children: ReactNode;
  runtimeUrl?: string;
}

type ProviderComponent = ComponentType<{
  children: ReactNode;
  runtimeUrl: string;
  a2ui?: { catalog?: unknown };
}>;

/**
 * CopilotShell wraps children in CopilotKitProvider when a runtimeUrl is
 * supplied. When no runtimeUrl is given, children are rendered unwrapped —
 * OpenTurbo's stub agent dispatcher (Task 14) provides offline functionality.
 *
 * CopilotKitProvider is loaded lazily so that @copilotkit/react-core/v2's
 * unconditional CSS side-effect import does not break the Node.js test runner.
 */
export function CopilotShell({ children, runtimeUrl }: CopilotShellProps) {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null);

  useEffect(() => {
    if (!runtimeUrl) return;
    import("@copilotkit/react-core/v2").then((mod) => {
      setProvider(() => mod.CopilotKitProvider as ProviderComponent);
    }).catch(() => {
      // In Node/test env the SDK's transitive CSS import throws and this is
      // the always-expected branch: children render unwrapped. In a browser
      // (Vite/Electron renderer) the dynamic import resolves and the next
      // render wraps children in CopilotKitProvider.
    });
  }, [runtimeUrl]);

  if (!runtimeUrl || !Provider) {
    // No runtime endpoint configured, or SDK not yet loaded.
    return <>{children}</>;
  }

  return (
    <Provider runtimeUrl={runtimeUrl} a2ui={{ catalog: openTurboCopilotCatalog }}>
      {children}
    </Provider>
  );
}
