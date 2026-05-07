import { Progress, Stack, Text } from "@mantine/core";

export interface OTProgressBarProps {
  label: string;
  value: number;
  color?: string;
}

export function OTProgressBar({ label, value, color = "teal" }: OTProgressBarProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(100, safe));
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Progress
        value={clamped}
        color={color}
        size="sm"
        radius="xl"
        aria-label={label}
      />
    </Stack>
  );
}
