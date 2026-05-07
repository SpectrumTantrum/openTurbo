import { S, validate, type Schema } from "./schema.js";

export interface ComponentDefinition<T> {
  name: string;
  description: string;
  schema: Schema<T>;
  validateProps: (value: unknown) => { ok: true; value: T } | { ok: false; error: string };
}

function define<T>(name: string, description: string, schema: Schema<T>): ComponentDefinition<T> {
  return { name, description, schema, validateProps: (value) => validate(schema, value) };
}

const studyPlanSchema = S.object({
  title: S.string(),
  steps: S.array(S.object({
    id: S.string(),
    label: S.string(),
    durationLabel: S.optional(S.string())
  }))
});

const reviewQueueSchema = S.object({
  dueCount: S.number(),
  preview: S.array(S.object({ cardId: S.string(), front: S.string() }))
});

const weakAreasSchema = S.object({
  areas: S.array(S.object({ id: S.string(), label: S.string(), score: S.number() }))
});

const packProgressSchema = S.object({
  packId: S.string(),
  title: S.string(),
  mastery: S.number(),
  cardsTotal: S.number(),
  cardsDue: S.number()
});

const generationPreviewSchema = S.object({
  sourceId: S.string(),
  sourceTitle: S.string(),
  outputs: S.array(S.enum(["notes", "flashcards", "quiz", "mindmap", "podcast"] as const)),
  selectedOutputs: S.array(S.enum(["notes", "flashcards", "quiz", "mindmap", "podcast"] as const))
});

const jobStatusSchema = S.object({
  jobs: S.array(S.object({
    id: S.string(),
    label: S.string(),
    detail: S.string(),
    status: S.enum(["queued", "running", "completed", "failed"] as const),
    progress: S.number()
  }))
});

const sourcePickerSchema = S.object({
  title: S.string(),
  sources: S.array(S.object({ id: S.string(), title: S.string(), kindLabel: S.string() }))
});

const syncStatusSchema = S.object({
  enabled: S.boolean(),
  state: S.enum(["offline", "connected", "syncing", "error"] as const),
  message: S.string(),
  lastSyncLabel: S.optional(S.string())
});

export const definitions = {
  StudyPlanCard: define(
    "StudyPlanCard",
    "Show an ordered, time-boxed study plan with start actions per step.",
    studyPlanSchema
  ),
  ReviewQueueCard: define(
    "ReviewQueueCard",
    "Show due flashcard count with a short preview list and an Open review action.",
    reviewQueueSchema
  ),
  WeakAreasCard: define(
    "WeakAreasCard",
    "Show topics or cards the learner is struggling with, ranked by recent score.",
    weakAreasSchema
  ),
  PackProgressCard: define(
    "PackProgressCard",
    "Show mastery progress and card counts for a single study pack.",
    packProgressSchema
  ),
  GenerationPreviewCard: define(
    "GenerationPreviewCard",
    "Plan a pending generation: source, output kinds, with explicit confirm action.",
    generationPreviewSchema
  ),
  JobStatusCard: define(
    "JobStatusCard",
    "Show the queue of background jobs and their progress / status.",
    jobStatusSchema
  ),
  SourcePickerCard: define(
    "SourcePickerCard",
    "Let the learner pick a source from a short curated list.",
    sourcePickerSchema
  ),
  SyncStatusCard: define(
    "SyncStatusCard",
    "Show optional sync server status, last sync time, and current state.",
    syncStatusSchema
  )
} as const satisfies Record<string, ComponentDefinition<unknown>>;

export type ComponentName = keyof typeof definitions;

export function definitionFor(name: string): ComponentDefinition<unknown> | undefined {
  if (Object.prototype.hasOwnProperty.call(definitions, name)) {
    return (definitions as Record<string, ComponentDefinition<unknown>>)[name];
  }
  return undefined;
}

export function knownComponentNames(): string[] {
  return Object.keys(definitions);
}
