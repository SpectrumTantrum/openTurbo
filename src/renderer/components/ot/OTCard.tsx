import { Card, Group, Text } from "@mantine/core";
import type { MantineSpacing } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTCardProps {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  withBorder?: boolean;
  padding?: MantineSpacing;
}

export function OTCard({ title, aside, children, withBorder = true, padding = "md" }: OTCardProps) {
  return (
    <Card
      role={title ? "region" : undefined}
      aria-label={title}
      radius={8}
      withBorder={withBorder}
      padding={padding}
    >
      {(title || aside) && (
        <Group justify="space-between" mb="xs">
          {title && <Text fw={800} size="sm">{title}</Text>}
          {aside}
        </Group>
      )}
      {children}
    </Card>
  );
}
