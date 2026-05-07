import { Stack } from "@mantine/core";
import { OTCard, OTActionButton } from "../ot/index.js";

export interface StudyPlanStep {
  id: string;
  label: string;
  durationLabel?: string;
}

export interface StudyPlanCardProps {
  title: string;
  steps: StudyPlanStep[];
  onStartStep: (id: string) => void;
}

export function StudyPlanCard({ title, steps, onStartStep }: StudyPlanCardProps) {
  return (
    <OTCard title={title}>
      <Stack gap={6}>
        {steps.map((step, index) => (
          <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong style={{ minWidth: 22 }}>{index + 1}.</strong>
            <span style={{ flex: 1 }}>
              {step.label}
              {step.durationLabel && <small style={{ marginLeft: 8, color: "gray" }}>{step.durationLabel}</small>}
            </span>
            <OTActionButton
              label={`Start: ${step.label}`}
              onClick={() => onStartStep(step.id)}
              variant="subtle"
            />
          </div>
        ))}
      </Stack>
    </OTCard>
  );
}
