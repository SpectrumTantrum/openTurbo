import { OTCard, OTInlineAlert } from "../components/ot/index.js";
import { describeRendererFailure } from "./errors.js";

export interface SafeErrorCardProps {
  error: unknown;
  dev?: boolean;
}

export function SafeErrorCard({ error, dev = false }: SafeErrorCardProps) {
  const description = describeRendererFailure(error, { dev });
  return (
    <OTCard>
      <OTInlineAlert
        tone="warn"
        title={description.headline}
        message={description.detail ?? "The assistant returned a response we couldn't render."}
      />
    </OTCard>
  );
}
