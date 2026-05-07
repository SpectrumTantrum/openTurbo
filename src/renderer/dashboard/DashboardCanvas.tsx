import { Stack, Text } from "@mantine/core";
import { A2UIRender } from "../a2ui/A2UIRender.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface DashboardCanvasProps {
  payloads: A2UIPayload[];
  onAction: (actionId: string, args?: unknown) => void;
  dev?: boolean;
}

export function DashboardCanvas({ payloads, onAction, dev = false }: DashboardCanvasProps) {
  if (payloads.length === 0) {
    return (
      <Stack align="center" py="lg">
        <Text size="sm" c="dimmed">Ask the assistant to assemble your dashboard.</Text>
      </Stack>
    );
  }
  return (
    <Stack gap="md">
      {payloads.map((payload, index) => (
        <A2UIRender
          key={index}
          payload={payload}
          handlers={{ onAction }}
          dev={dev}
        />
      ))}
    </Stack>
  );
}
