import { Group, Stack } from "@mantine/core";
import { OTCard, OTProgressBar, OTStatusBadge } from "../ot/index.js";
import type { OTStatus } from "../ot/index.js";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobStatusItem {
  id: string;
  label: string;
  detail: string;
  status: JobStatus;
  progress: number;
}

const STATUS_TO_OT: Record<JobStatus, OTStatus> = {
  queued: "neutral",
  running: "info",
  completed: "ok",
  failed: "error"
};

export interface JobStatusCardProps {
  jobs: JobStatusItem[];
}

export function JobStatusCard({ jobs }: JobStatusCardProps) {
  return (
    <OTCard title="Jobs">
      <Stack gap={8}>
        {jobs.map((job) => (
          <Stack key={job.id} gap={2}>
            <Group justify="space-between">
              <span>
                <strong>{job.label}</strong>
                <small style={{ marginLeft: 6, color: "gray" }}>{job.detail}</small>
              </span>
              <OTStatusBadge status={STATUS_TO_OT[job.status]} label={job.status} />
            </Group>
            {job.status === "running" && (
              <OTProgressBar label={job.label} value={job.progress} hideLabel />
            )}
          </Stack>
        ))}
      </Stack>
    </OTCard>
  );
}
