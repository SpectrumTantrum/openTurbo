import React from "react";
import {
  GenerationPreviewCard,
  JobStatusCard,
  PackProgressCard,
  ReviewQueueCard,
  SourcePickerCard,
  StudyPlanCard,
  SyncStatusCard,
  WeakAreasCard,
  type GenerationOutput
} from "../components/study/index.js";
import type { ComponentName } from "./definitions.js";

export interface RendererContext {
  emit: (actionId: string, args?: unknown) => void;
  getActionId: (actionName: string) => string | undefined;
}

type RendererFn = (props: unknown, ctx: RendererContext) => React.ReactElement;

const renderers: Record<ComponentName, RendererFn> = {
  StudyPlanCard: (props, ctx) => {
    const typed = props as Parameters<typeof StudyPlanCard>[0];
    return (
      <StudyPlanCard
        {...typed}
        onStartStep={(id) => emitIfWired(ctx, "onStartStep", id)}
      />
    );
  },
  ReviewQueueCard: (props, ctx) => {
    const typed = props as Parameters<typeof ReviewQueueCard>[0];
    return (
      <ReviewQueueCard
        {...typed}
        onOpenReview={() => emitIfWired(ctx, "onOpenReview")}
      />
    );
  },
  WeakAreasCard: (props, ctx) => {
    const typed = props as Parameters<typeof WeakAreasCard>[0];
    return (
      <WeakAreasCard
        {...typed}
        onFocusArea={(id) => emitIfWired(ctx, "onFocusArea", id)}
      />
    );
  },
  PackProgressCard: (props, ctx) => {
    const typed = props as Parameters<typeof PackProgressCard>[0];
    return (
      <PackProgressCard
        {...typed}
        onOpenPack={() => emitIfWired(ctx, "onOpenPack")}
      />
    );
  },
  GenerationPreviewCard: (props, ctx) => {
    const typed = props as Parameters<typeof GenerationPreviewCard>[0];
    return (
      <GenerationPreviewCard
        {...typed}
        onToggleOutput={(o: GenerationOutput) => emitIfWired(ctx, "onToggleOutput", o)}
        onConfirm={(selected) => emitIfWired(ctx, "onConfirm", selected)}
      />
    );
  },
  JobStatusCard: (props) => {
    const typed = props as Parameters<typeof JobStatusCard>[0];
    return <JobStatusCard {...typed} />;
  },
  SourcePickerCard: (props, ctx) => {
    const typed = props as Parameters<typeof SourcePickerCard>[0];
    return (
      <SourcePickerCard
        {...typed}
        onSelect={(id) => emitIfWired(ctx, "onSelect", id)}
      />
    );
  },
  SyncStatusCard: (props) => {
    const typed = props as Parameters<typeof SyncStatusCard>[0];
    return <SyncStatusCard {...typed} />;
  }
};

function emitIfWired(ctx: RendererContext, name: string, args?: unknown): void {
  const id = ctx.getActionId(name);
  if (id !== undefined) {
    ctx.emit(id, args);
  }
}

export function renderForName(name: ComponentName, props: unknown, ctx: RendererContext): React.ReactElement {
  return renderers[name](props, ctx);
}
