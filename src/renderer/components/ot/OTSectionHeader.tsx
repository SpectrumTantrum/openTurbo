import { Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTSectionHeaderProps {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}

export function OTSectionHeader({ title, eyebrow, trailing }: OTSectionHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end">
      <Stack gap={2}>
        {eyebrow && <small>{eyebrow}</small>}
        <Text component="h2" fw={900} size="md">{title}</Text>
      </Stack>
      {trailing}
    </Group>
  );
}
