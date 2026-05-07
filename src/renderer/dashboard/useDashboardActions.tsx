// src/renderer/dashboard/useDashboardActions.tsx
import { useState, type ReactNode } from "react";
import { ConfirmActionModal } from "../a2ui/ConfirmActionModal.js";
import { classifyAction } from "../a2ui/actionBoundary.js";
import type { OpenTurboClient } from "../data/client.js";
import type { GenerationOutput } from "../components/study/index.js";

export interface UseDashboardActionsOptions {
  client: OpenTurboClient;
  providerReady: boolean;
  defaultSourceId?: string;
  defaultPackId?: string;
  onActionFinished: () => void;
}

interface PendingAction {
  actionId: string;
  args: unknown;
  title: string;
  message: string;
  confirmLabel: string;
}

export function useDashboardActions(options: UseDashboardActionsOptions) {
  const { client, providerReady, defaultSourceId, defaultPackId, onActionFinished } = options;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  function dispatch(actionId: string, args?: unknown): void {
    setLastError(null);
    const entry = classifyAction(actionId);
    if (entry.kind === "blocked") {
      setLastError(entry.description);
      return;
    }
    if (entry.kind === "read-only") {
      // Read-only navigation is wired in App.tsx; ignore here.
      return;
    }
    if (!providerReady) {
      setLastError("Configure a provider before performing this action.");
      return;
    }
    if (entry.requiresConfirmation) {
      setPending({
        actionId,
        args,
        title: entry.confirmTitle ?? "Confirm action?",
        message: entry.confirmMessage ? entry.confirmMessage(args) : entry.description,
        confirmLabel: actionConfirmLabel(actionId)
      });
      return;
    }
    void runMutating(actionId, args);
  }

  async function runMutating(actionId: string, args: unknown): Promise<void> {
    try {
      switch (actionId) {
        case "generate-pack": {
          const outputs = (Array.isArray(args) ? args : ["notes"]) as GenerationOutput[];
          const sourceId = defaultSourceId;
          if (!sourceId) {
            setLastError("Select a source before generating.");
            return;
          }
          await client.generate({ sourceId, outputs });
          break;
        }
        case "export-pack": {
          const packId = (args as { packId?: string } | undefined)?.packId ?? defaultPackId;
          const format = ((args as { format?: "markdown" | "json" | "anki-csv" } | undefined)?.format ?? "json") as "markdown" | "json" | "anki-csv";
          if (!packId) {
            setLastError("Select a study pack before exporting.");
            return;
          }
          await client.exportPack(packId, format);
          break;
        }
        case "update-settings": {
          const patch = (args as Parameters<OpenTurboClient["updateSettings"]>[0]) ?? {};
          await client.updateSettings(patch);
          break;
        }
        case "test-provider": {
          const id = typeof args === "string" ? args : undefined;
          if (!id) {
            setLastError("Specify a provider id.");
            return;
          }
          await client.testProvider(id);
          break;
        }
        default:
          setLastError(`Unsupported mutating action: ${actionId}`);
          return;
      }
      onActionFinished();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  }

  const modal: ReactNode = pending
    ? <ConfirmActionModal
        opened={true}
        title={pending.title}
        message={pending.message}
        confirmLabel={pending.confirmLabel}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const current = pending;
          setPending(null);
          void runMutating(current.actionId, current.args);
        }}
      />
    : null;

  return { modal, dispatch, lastError };
}

function actionConfirmLabel(actionId: string): string {
  switch (actionId) {
    case "generate-pack": return "Generate";
    case "export-pack": return "Export";
    case "update-settings": return "Apply";
    default: return "Confirm";
  }
}
