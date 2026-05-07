import type { A2UIPayload } from "./catalog.js";

export interface DashboardLayout {
  payloads: A2UIPayload[];
}

export const STATIC_OVERVIEW_LAYOUT: DashboardLayout = {
  payloads: [
    {
      component: "ReviewQueueCard",
      props: { dueCount: 0, preview: [] },
      actions: { onOpenReview: { actionId: "open-review" } }
    },
    {
      component: "WeakAreasCard",
      props: { areas: [] },
      actions: { onFocusArea: { actionId: "show-weak-area" } }
    }
  ]
};

export interface SnapshotHints {
  dueCount: number;
  weakAreas: string[];
  jobs: Array<{ id: string; label: string; detail: string; status: "queued" | "running" | "completed" | "failed"; progress: number }>;
  firstSourceTitle?: string;
}

export function samplePayloadFor(prompt: string, snapshotHints: SnapshotHints): DashboardLayout {
  const lower = prompt.toLowerCase();
  if (lower.includes("review")) {
    return {
      payloads: [
        {
          component: "ReviewQueueCard",
          props: { dueCount: snapshotHints.dueCount, preview: [] },
          actions: { onOpenReview: { actionId: "open-review" } }
        }
      ]
    };
  }
  if (lower.includes("weak")) {
    return {
      payloads: [
        {
          component: "WeakAreasCard",
          props: {
            areas: snapshotHints.weakAreas.map((label, idx) => ({ id: `wa_${idx}`, label, score: 0.4 }))
          },
          actions: { onFocusArea: { actionId: "show-weak-area" } }
        }
      ]
    };
  }
  if ((lower.includes("generat") || lower.includes("quiz") || lower.includes("flashcard")) && snapshotHints.firstSourceTitle) {
    return {
      payloads: [
        {
          component: "GenerationPreviewCard",
          props: {
            sourceId: "first",
            sourceTitle: snapshotHints.firstSourceTitle,
            outputs: ["notes", "flashcards", "quiz"],
            selectedOutputs: ["notes", "flashcards"]
          },
          actions: {
            onConfirm: { actionId: "generate-pack" },
            onToggleOutput: { actionId: "noop" }
          }
        }
      ]
    };
  }
  if (lower.includes("job") || lower.includes("ready")) {
    return {
      payloads: [
        { component: "JobStatusCard", props: { jobs: snapshotHints.jobs }, actions: {} }
      ]
    };
  }
  return STATIC_OVERVIEW_LAYOUT;
}
