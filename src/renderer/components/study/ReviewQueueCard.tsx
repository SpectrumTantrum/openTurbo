import { Group, Stack, Text } from "@mantine/core";
import { OTCard, OTActionButton, OTMetric } from "../ot/index.js";

export interface ReviewQueueCardProps {
  dueCount: number;
  preview: Array<{ cardId: string; front: string }>;
  onOpenReview: () => void;
}

export function ReviewQueueCard({ dueCount, preview, onOpenReview }: ReviewQueueCardProps) {
  return (
    <OTCard title="Review queue">
      <Group justify="space-between" align="flex-start">
        <OTMetric label="Cards due" value={dueCount} />
        <OTActionButton label="Open review session" onClick={onOpenReview} variant="filled" />
      </Group>
      <Stack gap={2} mt="sm">
        {preview.slice(0, 5).map((card) => (
          <Text key={card.cardId} size="sm">{card.front}</Text>
        ))}
      </Stack>
    </OTCard>
  );
}
