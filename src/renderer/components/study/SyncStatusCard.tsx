import { Stack, Text } from "@mantine/core";
import { OTCard, OTStatusBadge } from "../ot/index.js";
import type { OTStatus } from "../ot/index.js";

export type SyncState = "offline" | "connected" | "syncing" | "error";

const STATE_TO_OT: Record<SyncState, OTStatus> = {
  offline: "neutral",
  connected: "ok",
  syncing: "info",
  error: "error"
};

export interface SyncStatusCardProps {
  enabled: boolean;
  state: SyncState;
  message: string;
  lastSyncLabel?: string;
}

export function SyncStatusCard({ enabled, state, message, lastSyncLabel }: SyncStatusCardProps) {
  return (
    <OTCard title="Sync">
      <Stack gap={4}>
        <OTStatusBadge status={STATE_TO_OT[state]} label={state} />
        <Text size="sm">{message}</Text>
        {lastSyncLabel && (
          <Text size="xs" c="dimmed">Last sync: <span>{lastSyncLabel}</span></Text>
        )}
        {!enabled && <Text size="xs" c="dimmed">Sync is disabled.</Text>}
      </Stack>
    </OTCard>
  );
}
