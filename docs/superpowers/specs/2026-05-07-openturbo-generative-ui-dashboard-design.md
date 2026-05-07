# OpenTurbo Generative UI Dashboard Design

Date: 2026-05-07
Branch: development
Status: Approved design; implementation plan not written yet

## Summary

OpenTurbo should move from a crowded fixed dashboard to a generative study dashboard. The first screen should feel like a calm study activity overview, with a bottom assistant prompt that can assemble useful dashboard surfaces on demand.

The assistant must not render arbitrary UI. It can only compose OpenTurbo-approved components implemented with Mantine and exposed through an A2UI catalog. CopilotKit and AG-UI provide the assistant/runtime layer, A2UI provides the declarative UI protocol, and OpenTurbo owns the final React renderers and action boundaries.

## User Decisions

- Default product direction: Study Activity Overview, not a library-first dashboard.
- Opening a study item should enter a focused full-page study workspace.
- Generative UI should use approved OpenTurbo components, not open-ended arbitrary UI.
- Mantine should remain the first component foundation.
- A2UI should be considered with CopilotKit/AG-UI as the controlled generative UI contract.

## Current Context

OpenTurbo currently uses React, Mantine, Recharts, React Flow, Vite, and Electron. The renderer is centered around a large `App.tsx` with a desktop shell, library pane, editor pane, assistant pane, job queue, and full-page views for spaces, review, analytics, sync, and settings.

The current assistant area supports provider status, local/BYOK chat over a selected pack, generation actions, and mastery display. This behavior is useful, but the dashboard feels crowded because multiple heavy surfaces compete at the same time.

## Architecture

The revised architecture is:

```text
User asks assistant
  -> CopilotKit handles assistant UI, runtime events, and agent communication
  -> AG-UI carries agent-user interaction events
  -> Agent emits A2UI declarative UI messages
  -> OpenTurbo validates messages against an approved A2UI catalog
  -> Mantine-based OpenTurbo renderers draw the UI
  -> Confirmed actions call existing OpenTurbo client/IPC functions
```

The core rule is that the agent describes intent, but OpenTurbo renders the interface. A2UI payloads are data, not executable UI code. Unknown component names, invalid props, or blocked actions must fail safely.

## Component Catalog

OpenTurbo should define an internal Mantine-first component catalog with three layers.

### Base OpenTurbo Wrappers

- `OTCard`
- `OTMetric`
- `OTStatusBadge`
- `OTActionButton`
- `OTEmptyState`
- `OTSectionHeader`
- `OTProgressBar`
- `OTInlineAlert`

These components wrap Mantine primitives and encode OpenTurbo spacing, radius, colors, typography, accessibility defaults, and loading/error behavior.

### Study Components

- `StudyPlanCard`
- `ReviewQueueCard`
- `GenerationPreviewCard`
- `PackProgressCard`
- `WeakAreasCard`
- `SourcePickerCard`
- `JobStatusCard`
- `SyncStatusCard`

These are the first components the assistant may render into the dashboard. They should be useful with mock/local data before CopilotKit is connected.

### A2UI Registry

The catalog should follow CopilotKit/A2UI's bring-your-own-catalog shape:

- `definitions.ts`: model-facing component names, descriptions, and prop schemas.
- `renderers.tsx`: React renderers keyed by the same names, implemented with OpenTurbo/Mantine components.
- `catalog.ts`: the exported approved catalog for CopilotKit/A2UI integration.

Definitions should be descriptive enough for the model to choose components correctly, but strict enough that OpenTurbo can validate props before rendering.

## Product Flow

The default screen becomes the Generative Study Dashboard.

The bottom assistant prompt remains visible and becomes the main way to shape the dashboard. Example prompts:

- "Build my review plan for today."
- "Show weak topics from this pack."
- "Prepare a quiz from these sources."
- "Show what is still generating and what is ready."

The agent responds with approved A2UI component descriptions. OpenTurbo renders those components into a dashboard canvas using native Mantine-based components.

Selecting a generated dashboard item opens a focused full-page study workspace. The workspace keeps notes, flashcards, quiz, mind map, podcast, and assistant tools, but only the relevant study surface is primary at a time. The old three-pane layout becomes a focused workspace mode, not the app's default first impression.

## Action Boundaries

Read-only rendering is allowed without confirmation:

- Render study plans.
- Render progress snapshots.
- Render review queues.
- Render weak-area summaries.
- Render source or pack pickers.
- Render job and sync status.

Mutating actions require explicit confirmation:

- Generate notes, flashcards, quiz, mind map, or podcast output.
- Start or cancel jobs.
- Export files.
- Sync data.
- Change provider or app settings.
- Delete or overwrite user data.

Blocked behavior:

- Arbitrary HTML or remote script rendering.
- Unregistered component types.
- Hidden side effects during render.
- Direct model access to filesystem, settings, or IPC without an approved action.

## Fallbacks

- If CopilotKit is unavailable, show a static Study Activity Overview.
- If A2UI rendering fails, show a safe error card with the unsupported component or validation issue.
- If a model emits invalid props, development builds should expose validation detail; production builds should show a concise safe fallback.
- If provider setup is incomplete, dashboard components should render disabled actions with clear provider guidance.

## Testing

The first implementation should be testable before live agent integration.

Required coverage:

- Unit tests for prop validation and catalog lookups.
- Renderer tests for each approved study component.
- Interaction tests for action confirmation boundaries.
- Browser/DOM tests for the main flow: ask assistant, render approved dashboard components, open focused study workspace, confirm a generation action.
- Regression tests that unknown components and invalid props do not crash the renderer.

## Staged Delivery

1. Extract a small Mantine-first OpenTurbo component layer.
2. Build the study component catalog with local mock data.
3. Add the A2UI registry and renderer using fixed sample payloads.
4. Replace the crowded default dashboard with the Generative Study Dashboard shell and static fallback.
5. Wire CopilotKit/AG-UI to render approved A2UI payloads.
6. Add confirmed action dispatch to existing generation, chat, provider health, export, sync, and workspace navigation flows.

## External References

- Google A2UI repository: https://github.com/google/A2UI
- A2UI docs: https://a2ui.org/
- A2UI with AG-UI guide: https://a2ui.org/guides/a2ui-with-any-agent-framework/
- CopilotKit A2UI docs: https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui
- CopilotKit dynamic schema A2UI docs: https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/dynamic-schema
- CopilotKit fixed schema A2UI docs: https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/fixed-schema

The A2UI/CopilotKit surface is moving quickly. The implementation plan should re-check official docs before adding dependencies or coding against specific APIs.
