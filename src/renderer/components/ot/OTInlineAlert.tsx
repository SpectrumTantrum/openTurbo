import { Alert } from "@mantine/core";

export type OTAlertTone = "info" | "warn" | "error" | "success";

const COLORS: Record<OTAlertTone, string> = {
  info: "blue",
  warn: "yellow",
  error: "red",
  success: "teal"
};

export interface OTInlineAlertProps {
  tone: OTAlertTone;
  message: string;
  title?: string;
}

export function OTInlineAlert({ tone, message, title }: OTInlineAlertProps) {
  return (
    <Alert
      role="status"
      color={COLORS[tone]}
      title={title}
      data-tone={tone}
      variant="light"
    >
      {message}
    </Alert>
  );
}
