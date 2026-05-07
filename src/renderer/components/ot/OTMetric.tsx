import { Stack, Text } from "@mantine/core";

export interface OTMetricProps {
  label: string;
  value: string | number;
  delta?: { direction: "up" | "down" | "flat"; text: string };
}

export function OTMetric({ label, value, delta }: OTMetricProps) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={900} size="xl">{value}</Text>
      {delta && (
        <Text
          component="span"
          size="xs"
          c={delta.direction === "up" ? "teal" : delta.direction === "down" ? "red" : "gray"}
          data-direction={delta.direction}
        >
          {delta.text}
        </Text>
      )}
    </Stack>
  );
}
