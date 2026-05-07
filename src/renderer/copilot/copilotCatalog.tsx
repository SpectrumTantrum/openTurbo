import { z } from "zod";
import { createCatalog, type CatalogDefinitions, type CatalogRenderers } from "@copilotkit/a2ui-renderer";
import {
  GenerationPreviewCard,
  JobStatusCard,
  PackProgressCard,
  ReviewQueueCard,
  SourcePickerCard,
  StudyPlanCard,
  SyncStatusCard,
  WeakAreasCard
} from "../components/study/index.js";
import { definitions } from "../a2ui/definitions.js";

// Zod re-declaration of each OpenTurbo definition's prop shape. The internal
// validatePayload() in src/renderer/a2ui/catalog.ts remains the authoritative
// security boundary; these schemas only live at the SDK boundary so CopilotKit
// can describe components to the agent.
const studyPlanProps = z.object({
  title: z.string(),
  steps: z.array(z.object({
    id: z.string(),
    label: z.string(),
    durationLabel: z.string().optional()
  }))
});

const reviewQueueProps = z.object({
  dueCount: z.number(),
  preview: z.array(z.object({ cardId: z.string(), front: z.string() }))
});

const weakAreasProps = z.object({
  areas: z.array(z.object({ id: z.string(), label: z.string(), score: z.number() }))
});

const packProgressProps = z.object({
  packId: z.string(),
  title: z.string(),
  mastery: z.number(),
  cardsTotal: z.number(),
  cardsDue: z.number()
});

const generationPreviewProps = z.object({
  sourceId: z.string(),
  sourceTitle: z.string(),
  outputs: z.array(z.enum(["notes", "flashcards", "quiz", "mindmap", "podcast"])),
  selectedOutputs: z.array(z.enum(["notes", "flashcards", "quiz", "mindmap", "podcast"]))
});

const jobStatusProps = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    label: z.string(),
    detail: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    progress: z.number()
  }))
});

const sourcePickerProps = z.object({
  title: z.string(),
  sources: z.array(z.object({ id: z.string(), title: z.string(), kindLabel: z.string() }))
});

const syncStatusProps = z.object({
  enabled: z.boolean(),
  state: z.enum(["offline", "connected", "syncing", "error"]),
  message: z.string(),
  lastSyncLabel: z.string().optional()
});

export const copilotDefinitions = {
  StudyPlanCard: { description: definitions.StudyPlanCard.description, props: studyPlanProps },
  ReviewQueueCard: { description: definitions.ReviewQueueCard.description, props: reviewQueueProps },
  WeakAreasCard: { description: definitions.WeakAreasCard.description, props: weakAreasProps },
  PackProgressCard: { description: definitions.PackProgressCard.description, props: packProgressProps },
  GenerationPreviewCard: { description: definitions.GenerationPreviewCard.description, props: generationPreviewProps },
  JobStatusCard: { description: definitions.JobStatusCard.description, props: jobStatusProps },
  SourcePickerCard: { description: definitions.SourcePickerCard.description, props: sourcePickerProps },
  SyncStatusCard: { description: definitions.SyncStatusCard.description, props: syncStatusProps }
} satisfies CatalogDefinitions;

export type CopilotDefinitions = typeof copilotDefinitions;

export const copilotRenderers: CatalogRenderers<CopilotDefinitions> = {
  StudyPlanCard: ({ props }) => (
    <StudyPlanCard {...props} onStartStep={() => undefined} />
  ),
  ReviewQueueCard: ({ props }) => (
    <ReviewQueueCard {...props} onOpenReview={() => undefined} />
  ),
  WeakAreasCard: ({ props }) => (
    <WeakAreasCard {...props} onFocusArea={() => undefined} />
  ),
  PackProgressCard: ({ props }) => (
    <PackProgressCard {...props} onOpenPack={() => undefined} />
  ),
  GenerationPreviewCard: ({ props }) => (
    <GenerationPreviewCard {...props} onToggleOutput={() => undefined} onConfirm={() => undefined} />
  ),
  JobStatusCard: ({ props }) => <JobStatusCard {...props} />,
  SourcePickerCard: ({ props }) => (
    <SourcePickerCard {...props} onSelect={() => undefined} />
  ),
  SyncStatusCard: ({ props }) => <SyncStatusCard {...props} />
};

export const openTurboCopilotCatalog = createCatalog(copilotDefinitions, copilotRenderers, {
  catalogId: "openturbo-catalog",
  includeBasicCatalog: true
});
