import { Chip, Group } from "@mantine/core";
import { OTCard, OTActionButton } from "../ot/index.js";

export type GenerationOutput = "notes" | "flashcards" | "quiz" | "mindmap" | "podcast";

export interface GenerationPreviewCardProps {
  sourceTitle: string;
  outputs: readonly GenerationOutput[];
  selectedOutputs: readonly GenerationOutput[];
  onToggleOutput: (output: GenerationOutput) => void;
  onConfirm: (selected: readonly GenerationOutput[]) => void;
}

export function GenerationPreviewCard({
  sourceTitle,
  outputs,
  selectedOutputs,
  onToggleOutput,
  onConfirm
}: GenerationPreviewCardProps) {
  const selected = new Set(selectedOutputs);
  return (
    <OTCard title={`Plan generation: ${sourceTitle}`}>
      <Group gap={6}>
        {outputs.map((output) => (
          <Chip
            key={output}
            checked={selected.has(output)}
            onChange={() => onToggleOutput(output)}
          >
            {output}
          </Chip>
        ))}
      </Group>
      <Group justify="flex-end" mt="sm">
        <OTActionButton
          label="Confirm generation"
          onClick={() => onConfirm(Array.from(selected) as GenerationOutput[])}
          variant="filled"
          kind="mutating"
        />
      </Group>
    </OTCard>
  );
}
