import { Badge } from "@mantine/core";

export type OTStatus = "ok" | "warn" | "error" | "info" | "neutral";

const COLORS: Record<OTStatus, string> = {
  ok: "teal",
  warn: "yellow",
  error: "red",
  info: "blue",
  neutral: "gray"
};

export interface OTStatusBadgeProps {
  status: OTStatus;
  label: string;
}

export function OTStatusBadge({ status, label }: OTStatusBadgeProps) {
  return <Badge color={COLORS[status]} variant="light">{label}</Badge>;
}
