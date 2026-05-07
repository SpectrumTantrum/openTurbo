import { Button, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTEmptyStateProps {
  icon: ReactNode;
  headline: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

export function OTEmptyState({ icon, headline, body, action }: OTEmptyStateProps) {
  return (
    <Stack align="center" gap={8} py="lg">
      <div aria-hidden="true">{icon}</div>
      <Text component="h3" fw={800}>{headline}</Text>
      {body && <Text size="sm" c="dimmed">{body}</Text>}
      {action && (
        <Button variant="light" onClick={action.onClick}>{action.label}</Button>
      )}
    </Stack>
  );
}
