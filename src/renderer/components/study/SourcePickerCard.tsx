import { Stack } from "@mantine/core";
import { OTCard, OTActionButton } from "../ot/index.js";

export interface SourcePickerOption {
  id: string;
  title: string;
  kindLabel: string;
}

export interface SourcePickerCardProps {
  title: string;
  sources: SourcePickerOption[];
  onSelect: (id: string) => void;
}

export function SourcePickerCard({ title, sources, onSelect }: SourcePickerCardProps) {
  return (
    <OTCard title={title}>
      <Stack gap={4}>
        {sources.map((source) => (
          <div key={source.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              <strong>{source.title}</strong>
              <small style={{ marginLeft: 6, color: "gray" }}>{source.kindLabel}</small>
            </span>
            <OTActionButton
              label={`Use source: ${source.title}`}
              onClick={() => onSelect(source.id)}
              variant="subtle"
            />
          </div>
        ))}
      </Stack>
    </OTCard>
  );
}
