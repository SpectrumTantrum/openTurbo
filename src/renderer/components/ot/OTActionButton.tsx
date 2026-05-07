import { Button } from "@mantine/core";
import type { ReactNode } from "react";

export type OTActionKind = "read-only" | "mutating";

export interface OTActionButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  kind?: OTActionKind;
  variant?: "filled" | "light" | "subtle";
}

export function OTActionButton({
  label,
  onClick,
  loading = false,
  disabled = false,
  icon,
  kind = "read-only",
  variant = "light"
}: OTActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      loading={loading}
      disabled={disabled || loading}
      leftSection={icon}
      variant={variant}
      data-kind={kind}
    >
      {label}
    </Button>
  );
}
