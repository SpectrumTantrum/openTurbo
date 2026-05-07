import { Progress, Stack, Text } from "@mantine/core";

export interface OTProgressBarProps {
  label: string;
  value: number;
  color?: string;
  hideLabel?: boolean;
}

export function OTProgressBar({ label, value, color = "teal", hideLabel = false }: OTProgressBarProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(100, safe));
  return (
    <Stack gap={4}>
      {!hideLabel && <Text size="xs" c="dimmed">{label}</Text>}
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
