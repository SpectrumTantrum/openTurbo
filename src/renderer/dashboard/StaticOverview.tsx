import { DashboardCanvas } from "./DashboardCanvas.js";
import type { A2UIPayload } from "../a2ui/catalog.js";
import type { SnapshotHints } from "../a2ui/samplePayloads.js";

export type StaticOverviewSnapshotHints = SnapshotHints;

export interface StaticOverviewProps {
  snapshotHints: StaticOverviewSnapshotHints;
  onAction: (actionId: string, args?: unknown) => void;
}

export function StaticOverview({ snapshotHints, onAction }: StaticOverviewProps) {
  const payloads: A2UIPayload[] = [
    {
      component: "ReviewQueueCard",
      props: { dueCount: snapshotHints.dueCount, preview: [] },
      actions: { onOpenReview: { actionId: "open-review" } }
    },
    {
      component: "WeakAreasCard",
      props: {
        areas: snapshotHints.weakAreas.map((label, index) => ({ id: `wa_${index}`, label, score: 0.4 }))
      },
      actions: { onFocusArea: { actionId: "show-weak-area" } }
    },
    {
      component: "JobStatusCard",
      props: { jobs: snapshotHints.jobs },
      actions: {}
    }
  ];
  return <DashboardCanvas payloads={payloads} onAction={onAction} />;
}
