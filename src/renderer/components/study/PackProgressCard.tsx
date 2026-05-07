import { Group } from "@mantine/core";
import { OTCard, OTActionButton, OTMetric, OTProgressBar } from "../ot/index.js";

export interface PackProgressCardProps {
  packId: string;
  title: string;
  mastery: number;
  cardsTotal: number;
  cardsDue: number;
  onOpenPack: () => void;
}

export function PackProgressCard({
  packId: _packId,
  title,
  mastery,
  cardsTotal,
  cardsDue,
  onOpenPack
}: PackProgressCardProps) {
  return (
    <OTCard title={title}>
      <Group justify="space-between" align="flex-start">
        <OTMetric label="Mastery" value={mastery} />
        <OTMetric label="Due / total" value={`${cardsDue} / ${cardsTotal}`} />
        <OTActionButton label={`Open pack: ${title}`} onClick={onOpenPack} variant="light" />
      </Group>
      <OTProgressBar label="Mastery" value={mastery} />
    </OTCard>
  );
}
