// src/renderer/a2ui/actionBoundary.ts
export type ActionKind = "read-only" | "mutating" | "blocked";

export interface ActionEntry {
  kind: ActionKind;
  description: string;
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmMessage?: (args?: unknown) => string;
}

export const ACTION_REGISTRY: Record<string, ActionEntry> = {
  "focus-source": { kind: "read-only", description: "Focus a source in the workspace." },
  "focus-pack": { kind: "read-only", description: "Focus a study pack in the workspace." },
  "focus-space": { kind: "read-only", description: "Focus a space." },
  "open-review": { kind: "read-only", description: "Open the review session view." },
  "open-pack": { kind: "read-only", description: "Open a study pack in focused workspace." },
  "filter-library": { kind: "read-only", description: "Apply a library filter." },
  "show-weak-area": { kind: "read-only", description: "Show details for a weak area." },

  "generate-pack": {
    kind: "mutating",
    description: "Generate notes/flashcards/quiz/mindmap/podcast for a source.",
    requiresConfirmation: true,
    confirmTitle: "Generate study material?",
    confirmMessage: (args) => `Generate ${describeOutputs(args)}.`
  },
  "review-card": {
    kind: "mutating",
    description: "Save a flashcard review rating.",
    requiresConfirmation: false
  },
  "send-chat": {
    kind: "mutating",
    description: "Send a chat message to the assistant.",
    requiresConfirmation: false
  },
  "export-pack": {
    kind: "mutating",
    description: "Export a study pack.",
    requiresConfirmation: true,
    confirmTitle: "Export study pack?",
    confirmMessage: (args) => `Export as ${String((args as { format?: string } | undefined)?.format ?? "?")}.`
  },
  "update-settings": {
    kind: "mutating",
    description: "Update OpenTurbo settings (sync URL, privacy, providers).",
    requiresConfirmation: true,
    confirmTitle: "Update settings?",
    confirmMessage: () => "The assistant has proposed a change to your settings."
  },
  "test-provider": {
    kind: "mutating",
    description: "Run a provider health check.",
    requiresConfirmation: false
  },

  "delete-source": { kind: "blocked", description: "Deleting sources is not exposed to the agent." },
  "delete-pack": { kind: "blocked", description: "Deleting packs is not exposed to the agent." },
  "cancel-job": { kind: "blocked", description: "Cancelling jobs is not exposed to the agent in this release." },
  "raw-html": { kind: "blocked", description: "Arbitrary HTML rendering is not allowed." }
};

const UNKNOWN_BLOCKED: ActionEntry = { kind: "blocked", description: "Unknown action." };

export function classifyAction(actionId: string): ActionEntry {
  return ACTION_REGISTRY[actionId] ?? UNKNOWN_BLOCKED;
}

function describeOutputs(args: unknown): string {
  if (Array.isArray(args)) return args.join(", ");
  return "study material";
}
