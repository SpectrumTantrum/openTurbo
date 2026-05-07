import { Group, Stack } from "@mantine/core";
import { Brain } from "lucide-react";
import { OTCard, OTActionButton, OTEmptyState } from "../ot/index.js";

export interface WeakArea {
  id: string;
  label: string;
  score: number;
}

export interface WeakAreasCardProps {
  areas: WeakArea[];
  onFocusArea: (id: string) => void;
}

export function WeakAreasCard({ areas, onFocusArea }: WeakAreasCardProps) {
  if (areas.length === 0) {
    return (
      <OTCard title="Weak areas">
        <OTEmptyState icon={<Brain size={20} />} headline="No weak areas right now" />
      </OTCard>
    );
  }
  return (
    <OTCard title="Weak areas">
      <Stack gap={6}>
        {[...areas].sort((a, b) => a.score - b.score).map((area) => (
          <Group key={area.id} justify="space-between">
            <span>{area.label}</span>
            <OTActionButton
              label={`Focus on ${area.label}`}
              onClick={() => onFocusArea(area.id)}
              variant="subtle"
            />
          </Group>
        ))}
      </Stack>
    </OTCard>
  );
}
