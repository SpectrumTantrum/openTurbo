import { Progress, Stack, Text } from "@mantine/core";

export interface OTProgressBarProps {
  label: string;
  value: number;
  color?: string;
}

export function OTProgressBar({ label, value, color = "teal" }: OTProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Progress
        value={clamped}
        color={color}
        size="sm"
        radius="xl"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </Stack>
  );
}
