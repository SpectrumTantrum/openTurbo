import { Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { AssistantPrompt } from "./AssistantPrompt.js";
import { DashboardCanvas } from "./DashboardCanvas.js";
import { StaticOverview, type StaticOverviewSnapshotHints } from "./StaticOverview.js";
import { createStubDispatcher } from "./dispatchAgent.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface GenerativeStudyDashboardProps {
  snapshotHints: StaticOverviewSnapshotHints;
  onAction: (actionId: string, args?: unknown) => void;
  agentAvailable: boolean;
}

export function GenerativeStudyDashboard({ snapshotHints, onAction, agentAvailable }: GenerativeStudyDashboardProps) {
  const dispatcher = useMemo(() => createStubDispatcher(snapshotHints), [snapshotHints]);
  const [payloads, setPayloads] = useState<A2UIPayload[] | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePrompt(value: string) {
    if (!agentAvailable) return;
    setPending(true);
    try {
      const layout = await dispatcher.dispatch(value);
      setPayloads(layout.payloads);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack className="generative-dashboard" gap="md">
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {payloads === null
          ? <StaticOverview snapshotHints={snapshotHints} onAction={onAction} />
          : <DashboardCanvas payloads={payloads} onAction={onAction} />}
      </div>
      <AssistantPrompt
        placeholder={agentAvailable ? "Ask the assistant to build a dashboard..." : "Ask the assistant (offline preview)..."}
        onSubmit={handlePrompt}
        disabled={!agentAvailable || pending}
      />
    </Stack>
  );
}
