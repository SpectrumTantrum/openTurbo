import { Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { AssistantPrompt } from "./AssistantPrompt.js";
import { DashboardCanvas } from "./DashboardCanvas.js";
import { StaticOverview, type StaticOverviewSnapshotHints } from "./StaticOverview.js";
import { createStubDispatcher } from "./dispatchAgent.js";
import { useA2UIRuntime, type A2UITransport } from "../copilot/useA2UIRuntime.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface GenerativeStudyDashboardProps {
  snapshotHints: StaticOverviewSnapshotHints;
  onAction: (actionId: string, args?: unknown) => void;
  agentAvailable: boolean;
  transport?: A2UITransport;
}

export function GenerativeStudyDashboard({ snapshotHints, onAction, agentAvailable, transport }: GenerativeStudyDashboardProps) {
  const dispatcher = useMemo(() => createStubDispatcher(snapshotHints), [snapshotHints]);
  const runtime = useA2UIRuntime({ onAction, transport });
  const [stubPayloads, setStubPayloads] = useState<A2UIPayload[] | null>(null);
  const [pending, setPending] = useState(false);

  const liveMode = Boolean(transport);
  const payloads = liveMode ? runtime.payloads : stubPayloads;

  async function handlePrompt(value: string) {
    if (!agentAvailable) return;
    setPending(true);
    try {
      if (liveMode) {
        await runtime.sendPrompt(value);
      } else {
        const layout = await dispatcher.dispatch(value);
        setStubPayloads(layout.payloads);
      }
    } finally {
      setPending(false);
    }
  }

  // In live mode we always show whatever the runtime has accumulated. In stub
  // mode the dashboard starts on StaticOverview until the first prompt lands.
  const showStatic = !liveMode && payloads === null;

  return (
    <Stack className="generative-dashboard" gap="md">
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {showStatic
          ? <StaticOverview snapshotHints={snapshotHints} onAction={onAction} />
          : <DashboardCanvas payloads={payloads ?? []} onAction={onAction} />}
      </div>
      <AssistantPrompt
        placeholder={agentAvailable ? "Ask the assistant to build a dashboard..." : "Ask the assistant (offline preview)..."}
        onSubmit={handlePrompt}
        disabled={!agentAvailable || pending}
      />
    </Stack>
  );
}
