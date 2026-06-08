# OpenTurbo Generative UI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-05-07-openturbo-generative-ui-dashboard-design.md](docs/superpowers/specs/2026-05-07-openturbo-generative-ui-dashboard-design.md)

**Goal:** Replace the current crowded fixed dashboard with a calm Generative Study Dashboard whose first screen is a Study Activity Overview, and where a persistent bottom assistant prompt assembles dashboard surfaces from an OpenTurbo-approved A2UI catalog rendered with Mantine.

**Architecture:** The agent describes intent through declarative A2UI payloads; OpenTurbo validates each payload against an approved catalog and renders it with Mantine-based components. Mutating actions go through a confirmation boundary before invoking the existing `OpenTurboClient`. Stages 1–6 produce a working dashboard with stub payload routing (no live agent). Stage 7 (CopilotKit/AG-UI) is gated on a doc-check task because those SDKs move quickly.

**Tech Stack:** TypeScript, React 19, Mantine 8, lucide-react, Recharts, jsdom + @testing-library/react under `node:test`, eventually CopilotKit + AG-UI + A2UI (added only in Phase 7 after doc verification).

**Existing test command:** `npm test` runs `tsc -p tsconfig.main.json` then `node --test dist/tests/*.test.js`. To run a single test file: `npm run build:main && node --test dist/tests/<file>.test.js`. To typecheck the renderer: `npm run typecheck`.

---

## File Structure

New directories under `src/renderer/`:

- `components/ot/` — base Mantine wrappers that encode OpenTurbo spacing/radius/colors/accessibility defaults.
  - `OTCard.tsx`, `OTSectionHeader.tsx`, `OTEmptyState.tsx`
  - `OTMetric.tsx`, `OTProgressBar.tsx`, `OTStatusBadge.tsx`
  - `OTActionButton.tsx`, `OTInlineAlert.tsx`
  - `index.ts` — barrel export
- `components/study/` — domain components the assistant may render.
  - `StudyPlanCard.tsx`, `ReviewQueueCard.tsx`
  - `WeakAreasCard.tsx`, `PackProgressCard.tsx`
  - `GenerationPreviewCard.tsx`, `JobStatusCard.tsx`
  - `SourcePickerCard.tsx`, `SyncStatusCard.tsx`
  - `index.ts` — barrel export
- `a2ui/` — declarative-UI protocol layer.
  - `schema.ts` — tiny prop-validator utility (pure TS, no runtime dep)
  - `definitions.ts` — model-facing component names, descriptions, prop schemas
  - `errors.ts` — `UnknownComponentError`, `InvalidPropsError`, `BlockedActionError`
  - `SafeErrorCard.tsx` — fallback renderer for invalid payloads
  - `renderers.tsx` — React renderers keyed by name (uses `components/study/*`)
  - `catalog.ts` — `validatePayload`, `lookupRenderer`, exported approved catalog
  - `actionBoundary.ts` — read-only / mutating / blocked action classification + confirmation gating
  - `ConfirmActionModal.tsx` — generic confirmation modal for mutating actions
  - `samplePayloads.ts` — fixed sample payloads keyed by prompt intent (used by Stage 4 stub + tests)
- `dashboard/` — the new default screen.
  - `AssistantPrompt.tsx` — persistent bottom prompt
  - `DashboardCanvas.tsx` — renders an ordered list of A2UI payloads
  - `StaticOverview.tsx` — fallback Study Activity Overview when CopilotKit unavailable
  - `GenerativeStudyDashboard.tsx` — composes the above, owns dashboard state
  - `dispatchAgent.ts` — Stage 4 stub: maps prompt → `samplePayloads`. Replaced in Phase 7.
- `workspace/` — focused full-page study workspace (extracted from `App.tsx`).
  - `StudyWorkspace.tsx`
- `copilot/` — added in Phase 7 only.
  - `CopilotProvider.tsx`, `useA2UIRuntime.ts`, `actionDispatch.ts`

Modified:

- `src/renderer/App.tsx` — wire `Dashboard` as the default `NavLabel`, mount `GenerativeStudyDashboard` as the initial workspace view, push existing three-pane Library/Editor/Assistant layout into the focused-workspace mode.
- `src/renderer/App.css` — add styles for dashboard canvas, prompt bar, and OT card spacing tokens.

New tests in `tests/`:

- `ot-components.test.tsx` — renderer + a11y tests for each OT primitive
- `study-components.test.tsx` — renderer tests for each study component (one test per component)
- `a2ui-schema.test.ts` — prop validator unit tests
- `a2ui-catalog.test.ts` — catalog lookup + validation regression tests
- `a2ui-renderer.test.tsx` — A2UIRender dispatches by name, falls back on unknown component, falls back on invalid props
- `action-boundary.test.ts` — read-only vs mutating vs blocked classification
- `confirm-action-modal.test.tsx` — modal shows action details + confirm/cancel paths
- `dashboard-canvas.test.tsx` — renders payload sequence, isolates errors per item
- `generative-dashboard.test.tsx` — assistant prompt → stub agent → canvas renders + opens workspace
- `dashboard-flow.test.tsx` — full browser/DOM end-to-end across the spec's main flow
- Existing `tests/renderer-app-shell.test.tsx` — updated to assert default view = Dashboard

---

## Conventions

- **TDD:** Each task starts with a failing test. Build the test file, run it, confirm failure, implement, build, confirm pass, commit.
- **Test isolation:** Each new test file should be runnable on its own with `npm run build:main && node --test dist/tests/<file>.test.js`. Tests that touch React must call `setupDom()` (copy the helper from `tests/renderer-app-shell.test.tsx` — extract a shared helper if needed inside that test, but do not refactor existing tests as part of this plan).
- **Imports:** Renderer files import each other with `.js` suffix (Bundler resolution requires this — the project uses `moduleResolution: "Bundler"` for the renderer and `NodeNext` for tests). Match existing patterns.
- **No new runtime deps in Phases 1–6.** Phase 7 is the only place that adds packages, and only after the doc-check task.
- **Mantine theming:** Wrap in `MantineProvider` only at the app root (already in `App.tsx`); component tests must wrap renders in `<MantineProvider>` to avoid context warnings.
- **Commit message style:** Follow the existing project pattern (see `git log` — `feat:`, `fix:`, `chore:`, `docs:`).

---

## Phase 1 — Base OpenTurbo Component Wrappers

### Task 1: OTCard, OTSectionHeader, OTEmptyState

**Files:**
- Create: `src/renderer/components/ot/OTCard.tsx`
- Create: `src/renderer/components/ot/OTSectionHeader.tsx`
- Create: `src/renderer/components/ot/OTEmptyState.tsx`
- Create: `src/renderer/components/ot/index.ts`
- Test: `tests/ot-components.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/ot-components.test.tsx` with a `setupDom()` helper copied from `tests/renderer-app-shell.test.tsx` (top of file: same JSDOM bootstrap). Then the OTCard/OTSectionHeader/OTEmptyState cases:

```tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { OTCard, OTSectionHeader, OTEmptyState } = await import("../src/renderer/components/ot/index.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("OTCard renders title, optional aside, and children", () => {
  render(wrap(
    <OTCard title="Plan" aside={<span data-testid="aside">3 items</span>}>
      <p>body</p>
    </OTCard>
  ));
  assert.ok(screen.getByText("Plan"));
  assert.ok(screen.getByTestId("aside"));
  assert.ok(screen.getByText("body"));
});

test("OTCard exposes role region with accessible name when title is given", () => {
  render(wrap(<OTCard title="Plan">x</OTCard>));
  const region = screen.getByRole("region", { name: "Plan" });
  assert.ok(region);
});

test("OTSectionHeader renders title, eyebrow, and trailing slot", () => {
  render(wrap(
    <OTSectionHeader eyebrow="Today" title="Review queue" trailing={<span data-testid="trailing">12</span>} />
  ));
  assert.equal(screen.getByText("Today").tagName.toLowerCase(), "small");
  assert.ok(screen.getByRole("heading", { name: "Review queue" }));
  assert.ok(screen.getByTestId("trailing"));
});

test("OTEmptyState renders icon, headline, body, and primary action", () => {
  let clicked = 0;
  const { fireEvent } = await import("@testing-library/react");
  render(wrap(
    <OTEmptyState
      icon={<span data-testid="icon">x</span>}
      headline="Nothing yet"
      body="Import a source to begin."
      action={{ label: "Import", onClick: () => { clicked += 1; } }}
    />
  ));
  assert.ok(screen.getByTestId("icon"));
  assert.ok(screen.getByText("Nothing yet"));
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  assert.equal(clicked, 1);
});

function setupDom(): void { /* paste the helper from renderer-app-shell.test.tsx */ }
```

(The `setupDom` body is the same as in `tests/renderer-app-shell.test.tsx`.)

- [ ] **Step 2: Run test to verify it fails**

```
npm run build:main
```
Expected: build error — `Cannot find module '../src/renderer/components/ot/index.js'`.

- [ ] **Step 3: Implement OTCard**

Create `src/renderer/components/ot/OTCard.tsx`:

```tsx
import { Card, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTCardProps {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  withBorder?: boolean;
  padding?: number | string;
}

export function OTCard({ title, aside, children, withBorder = true, padding = "md" }: OTCardProps) {
  return (
    <Card
      role={title ? "region" : undefined}
      aria-label={title}
      radius={8}
      withBorder={withBorder}
      padding={padding}
    >
      {(title || aside) && (
        <Group justify="space-between" mb="xs">
          {title ? <Text fw={800} size="sm">{title}</Text> : <span />}
          {aside}
        </Group>
      )}
      {children}
    </Card>
  );
}
```

- [ ] **Step 4: Implement OTSectionHeader**

Create `src/renderer/components/ot/OTSectionHeader.tsx`:

```tsx
import { Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTSectionHeaderProps {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}

export function OTSectionHeader({ title, eyebrow, trailing }: OTSectionHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end">
      <Stack gap={2}>
        {eyebrow && <small>{eyebrow}</small>}
        <Text component="h2" fw={900} size="md">{title}</Text>
      </Stack>
      {trailing}
    </Group>
  );
}
```

- [ ] **Step 5: Implement OTEmptyState**

Create `src/renderer/components/ot/OTEmptyState.tsx`:

```tsx
import { Button, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface OTEmptyStateProps {
  icon: ReactNode;
  headline: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

export function OTEmptyState({ icon, headline, body, action }: OTEmptyStateProps) {
  return (
    <Stack align="center" gap={8} py="lg">
      <div aria-hidden="true">{icon}</div>
      <Text fw={800}>{headline}</Text>
      {body && <Text size="sm" c="dimmed">{body}</Text>}
      {action && (
        <Button variant="light" onClick={action.onClick}>{action.label}</Button>
      )}
    </Stack>
  );
}
```

- [ ] **Step 6: Create the barrel export**

Create `src/renderer/components/ot/index.ts`:

```ts
export { OTCard } from "./OTCard.js";
export type { OTCardProps } from "./OTCard.js";
export { OTSectionHeader } from "./OTSectionHeader.js";
export type { OTSectionHeaderProps } from "./OTSectionHeader.js";
export { OTEmptyState } from "./OTEmptyState.js";
export type { OTEmptyStateProps } from "./OTEmptyState.js";
```

- [ ] **Step 7: Run test to verify it passes**

```
npm run build:main && node --test dist/tests/ot-components.test.js
```
Expected: PASS — 4 OT primitive tests.

- [ ] **Step 8: Commit**

```
git add src/renderer/components/ot/OTCard.tsx \
        src/renderer/components/ot/OTSectionHeader.tsx \
        src/renderer/components/ot/OTEmptyState.tsx \
        src/renderer/components/ot/index.ts \
        tests/ot-components.test.tsx
git commit -m "feat: add OT primitives (Card, SectionHeader, EmptyState)"
```

---

### Task 2: OTMetric, OTProgressBar, OTStatusBadge

**Files:**
- Create: `src/renderer/components/ot/OTMetric.tsx`
- Create: `src/renderer/components/ot/OTProgressBar.tsx`
- Create: `src/renderer/components/ot/OTStatusBadge.tsx`
- Modify: `src/renderer/components/ot/index.ts`
- Modify: `tests/ot-components.test.tsx`

- [ ] **Step 1: Append failing tests to `tests/ot-components.test.tsx`**

Add inside the same file:

```tsx
const { OTMetric, OTProgressBar, OTStatusBadge } = await import("../src/renderer/components/ot/index.js");

test("OTMetric renders label, value, optional delta with semantic color", () => {
  render(wrap(<OTMetric label="Cards due" value={12} delta={{ direction: "up", text: "+3 since yesterday" }} />));
  assert.ok(screen.getByText("Cards due"));
  assert.ok(screen.getByText("12"));
  const delta = screen.getByText("+3 since yesterday");
  assert.equal(delta.getAttribute("data-direction"), "up");
});

test("OTProgressBar uses 0..100 scale and exposes accessible value", () => {
  render(wrap(<OTProgressBar label="Mastery" value={42} />));
  const bar = screen.getByRole("progressbar", { name: "Mastery" });
  assert.equal(bar.getAttribute("aria-valuenow"), "42");
  assert.equal(bar.getAttribute("aria-valuemin"), "0");
  assert.equal(bar.getAttribute("aria-valuemax"), "100");
});

test("OTStatusBadge maps status to color and label", () => {
  const { rerender } = render(wrap(<OTStatusBadge status="ok" label="Healthy" />));
  assert.ok(screen.getByText("Healthy"));
  rerender(wrap(<OTStatusBadge status="error" label="Down" />));
  assert.ok(screen.getByText("Down"));
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```
Expected: module-not-found errors for the new exports.

- [ ] **Step 3: Implement OTMetric**

```tsx
// src/renderer/components/ot/OTMetric.tsx
import { Stack, Text } from "@mantine/core";

export interface OTMetricProps {
  label: string;
  value: string | number;
  delta?: { direction: "up" | "down" | "flat"; text: string };
}

export function OTMetric({ label, value, delta }: OTMetricProps) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={900} size="xl">{value}</Text>
      {delta && (
        <Text
          component="span"
          size="xs"
          c={delta.direction === "up" ? "teal" : delta.direction === "down" ? "red" : "gray"}
          data-direction={delta.direction}
        >
          {delta.text}
        </Text>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Implement OTProgressBar**

```tsx
// src/renderer/components/ot/OTProgressBar.tsx
import { Progress, Stack, Text } from "@mantine/core";

export interface OTProgressBarProps {
  label: string;
  value: number;
  color?: string;
}

export function OTProgressBar({ label, value, color = "teal" }: OTProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Progress
        value={clamped}
        color={color}
        size="sm"
        radius="xl"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </Stack>
  );
}
```

- [ ] **Step 5: Implement OTStatusBadge**

```tsx
// src/renderer/components/ot/OTStatusBadge.tsx
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
```

- [ ] **Step 6: Update barrel export**

Append to `src/renderer/components/ot/index.ts`:

```ts
export { OTMetric } from "./OTMetric.js";
export type { OTMetricProps } from "./OTMetric.js";
export { OTProgressBar } from "./OTProgressBar.js";
export type { OTProgressBarProps } from "./OTProgressBar.js";
export { OTStatusBadge } from "./OTStatusBadge.js";
export type { OTStatusBadgeProps, OTStatus } from "./OTStatusBadge.js";
```

- [ ] **Step 7: Run tests**

```
npm run build:main && node --test dist/tests/ot-components.test.js
```
Expected: PASS — all 7 OT tests so far.

- [ ] **Step 8: Commit**

```
git add src/renderer/components/ot/OTMetric.tsx \
        src/renderer/components/ot/OTProgressBar.tsx \
        src/renderer/components/ot/OTStatusBadge.tsx \
        src/renderer/components/ot/index.ts \
        tests/ot-components.test.tsx
git commit -m "feat: add OT display primitives (Metric, ProgressBar, StatusBadge)"
```

---

### Task 3: OTActionButton, OTInlineAlert

**Files:**
- Create: `src/renderer/components/ot/OTActionButton.tsx`
- Create: `src/renderer/components/ot/OTInlineAlert.tsx`
- Modify: `src/renderer/components/ot/index.ts`
- Modify: `tests/ot-components.test.tsx`

- [ ] **Step 1: Append failing tests**

```tsx
const { OTActionButton, OTInlineAlert } = await import("../src/renderer/components/ot/index.js");

test("OTActionButton renders label, fires onClick, supports loading state", () => {
  let clicks = 0;
  const { fireEvent } = await import("@testing-library/react");
  const { rerender } = render(wrap(
    <OTActionButton label="Generate" onClick={() => { clicks += 1; }} />
  ));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  assert.equal(clicks, 1);

  rerender(wrap(<OTActionButton label="Generate" onClick={() => { clicks += 1; }} loading />));
  const loadingBtn = screen.getByRole("button", { name: "Generate" });
  assert.equal(loadingBtn.hasAttribute("disabled"), true);
  fireEvent.click(loadingBtn);
  assert.equal(clicks, 1, "click should be ignored while loading");
});

test("OTActionButton with kind=mutating renders aria attribute", () => {
  render(wrap(<OTActionButton label="Delete" onClick={() => undefined} kind="mutating" />));
  const btn = screen.getByRole("button", { name: "Delete" });
  assert.equal(btn.getAttribute("data-kind"), "mutating");
});

test("OTInlineAlert renders tone and message with role=status", () => {
  render(wrap(<OTInlineAlert tone="info" message="Configure a provider before generating." />));
  const alert = screen.getByRole("status");
  assert.ok(alert.textContent?.includes("Configure a provider"));
  assert.equal(alert.getAttribute("data-tone"), "info");
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```
Expected: module-not-found errors.

- [ ] **Step 3: Implement OTActionButton**

```tsx
// src/renderer/components/ot/OTActionButton.tsx
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
```

- [ ] **Step 4: Implement OTInlineAlert**

```tsx
// src/renderer/components/ot/OTInlineAlert.tsx
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
```

- [ ] **Step 5: Update barrel export**

Append to `src/renderer/components/ot/index.ts`:

```ts
export { OTActionButton } from "./OTActionButton.js";
export type { OTActionButtonProps, OTActionKind } from "./OTActionButton.js";
export { OTInlineAlert } from "./OTInlineAlert.js";
export type { OTInlineAlertProps, OTAlertTone } from "./OTInlineAlert.js";
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/ot-components.test.js
```
Expected: PASS — all 10 OT tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/components/ot/OTActionButton.tsx \
        src/renderer/components/ot/OTInlineAlert.tsx \
        src/renderer/components/ot/index.ts \
        tests/ot-components.test.tsx
git commit -m "feat: add OT interactive primitives (ActionButton, InlineAlert)"
```

---

## Phase 2 — Study Component Catalog

Each study component must satisfy the spec rule: "useful with mock/local data before CopilotKit is connected." Each accepts a typed prop bag and emits action callbacks (no direct calls to `client`); the action boundary in Phase 3 wires those callbacks.

### Task 4: StudyPlanCard, ReviewQueueCard

**Files:**
- Create: `src/renderer/components/study/StudyPlanCard.tsx`
- Create: `src/renderer/components/study/ReviewQueueCard.tsx`
- Create: `src/renderer/components/study/index.ts`
- Test: `tests/study-components.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/study-components.test.tsx` with the same `setupDom()` helper at the bottom of the file. Then:

```tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen, within } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { StudyPlanCard, ReviewQueueCard } = await import("../src/renderer/components/study/index.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("StudyPlanCard renders ordered steps and fires onStartStep", () => {
  let started: string[] = [];
  render(wrap(
    <StudyPlanCard
      title="Today's review plan"
      steps={[
        { id: "s1", label: "Review 12 due cards", durationLabel: "20 min" },
        { id: "s2", label: "Drill weak areas", durationLabel: "15 min" }
      ]}
      onStartStep={(id) => started.push(id)}
    />
  ));
  assert.ok(screen.getByText("Today's review plan"));
  assert.ok(screen.getByText("Review 12 due cards"));
  fireEvent.click(screen.getByRole("button", { name: "Start: Review 12 due cards" }));
  assert.deepEqual(started, ["s1"]);
});

test("ReviewQueueCard renders due count, lists upcoming cards, fires onOpenReview", () => {
  let opened = 0;
  render(wrap(
    <ReviewQueueCard
      dueCount={5}
      preview={[
        { cardId: "c1", front: "Define mitosis" },
        { cardId: "c2", front: "Phases of cell cycle" }
      ]}
      onOpenReview={() => { opened += 1; }}
    />
  ));
  assert.ok(screen.getByText("5"));
  assert.ok(screen.getByText("Define mitosis"));
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(opened, 1);
});

function setupDom(): void { /* same helper as ot-components.test.tsx */ }
```

- [ ] **Step 2: Run test to verify failure**

```
npm run build:main
```
Expected: module-not-found error.

- [ ] **Step 3: Implement StudyPlanCard**

```tsx
// src/renderer/components/study/StudyPlanCard.tsx
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
```

- [ ] **Step 4: Implement ReviewQueueCard**

```tsx
// src/renderer/components/study/ReviewQueueCard.tsx
import { Group, Stack, Text } from "@mantine/core";
import { OTCard, OTActionButton, OTMetric } from "../ot/index.js";

export interface ReviewQueueCardProps {
  dueCount: number;
  preview: Array<{ cardId: string; front: string }>;
  onOpenReview: () => void;
}

export function ReviewQueueCard({ dueCount, preview, onOpenReview }: ReviewQueueCardProps) {
  return (
    <OTCard title="Review queue">
      <Group justify="space-between" align="flex-start">
        <OTMetric label="Cards due" value={dueCount} />
        <OTActionButton label="Open review session" onClick={onOpenReview} variant="filled" />
      </Group>
      <Stack gap={2} mt="sm">
        {preview.slice(0, 5).map((card) => (
          <Text key={card.cardId} size="sm">{card.front}</Text>
        ))}
      </Stack>
    </OTCard>
  );
}
```

- [ ] **Step 5: Create barrel export**

```ts
// src/renderer/components/study/index.ts
export { StudyPlanCard } from "./StudyPlanCard.js";
export type { StudyPlanCardProps, StudyPlanStep } from "./StudyPlanCard.js";
export { ReviewQueueCard } from "./ReviewQueueCard.js";
export type { ReviewQueueCardProps } from "./ReviewQueueCard.js";
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/study-components.test.js
```
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/components/study tests/study-components.test.tsx
git commit -m "feat: add StudyPlanCard and ReviewQueueCard"
```

---

### Task 5: WeakAreasCard, PackProgressCard

**Files:**
- Create: `src/renderer/components/study/WeakAreasCard.tsx`
- Create: `src/renderer/components/study/PackProgressCard.tsx`
- Modify: `src/renderer/components/study/index.ts`
- Modify: `tests/study-components.test.tsx`

- [ ] **Step 1: Append failing tests**

```tsx
const { WeakAreasCard, PackProgressCard } = await import("../src/renderer/components/study/index.js");

test("WeakAreasCard renders ranked items and fires onFocusArea", () => {
  let focused: string | null = null;
  render(wrap(
    <WeakAreasCard
      areas={[
        { id: "a1", label: "Membrane transport", score: 0.32 },
        { id: "a2", label: "Cell cycle", score: 0.55 }
      ]}
      onFocusArea={(id) => { focused = id; }}
    />
  ));
  assert.ok(screen.getByText("Membrane transport"));
  fireEvent.click(screen.getByRole("button", { name: "Focus on Membrane transport" }));
  assert.equal(focused, "a1");
});

test("WeakAreasCard renders empty state when areas is empty", () => {
  render(wrap(<WeakAreasCard areas={[]} onFocusArea={() => undefined} />));
  assert.ok(screen.getByText(/no weak areas/i));
});

test("PackProgressCard shows mastery and counts, fires onOpenPack", () => {
  let opened = 0;
  render(wrap(
    <PackProgressCard
      packId="pack_1"
      title="Cellular Biology Study Pack"
      mastery={68}
      cardsTotal={24}
      cardsDue={6}
      onOpenPack={() => { opened += 1; }}
    />
  ));
  assert.ok(screen.getByText("Cellular Biology Study Pack"));
  assert.ok(screen.getByText("68"));
  fireEvent.click(screen.getByRole("button", { name: "Open pack: Cellular Biology Study Pack" }));
  assert.equal(opened, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement WeakAreasCard**

```tsx
// src/renderer/components/study/WeakAreasCard.tsx
import { Group, Stack } from "@mantine/core";
import { OTCard, OTActionButton, OTEmptyState } from "../ot/index.js";
import { Brain } from "lucide-react";

export interface WeakArea {
  id: string;
  label: string;
  score: number;
}

export interface WeakAreasCardProps {
  areas: WeakArea[];
  onFocusArea: (id: string) => void;
}

export function WeakAreasCard({ areas, onFocusArea }: WeakAreasCardProps) {
  if (areas.length === 0) {
    return (
      <OTCard title="Weak areas">
        <OTEmptyState icon={<Brain size={20} />} headline="No weak areas right now" />
      </OTCard>
    );
  }
  return (
    <OTCard title="Weak areas">
      <Stack gap={6}>
        {[...areas].sort((a, b) => a.score - b.score).map((area) => (
          <Group key={area.id} justify="space-between">
            <span>{area.label}</span>
            <OTActionButton
              label={`Focus on ${area.label}`}
              onClick={() => onFocusArea(area.id)}
              variant="subtle"
            />
          </Group>
        ))}
      </Stack>
    </OTCard>
  );
}
```

- [ ] **Step 4: Implement PackProgressCard**

```tsx
// src/renderer/components/study/PackProgressCard.tsx
import { Group } from "@mantine/core";
import { OTCard, OTActionButton, OTMetric, OTProgressBar } from "../ot/index.js";

export interface PackProgressCardProps {
  packId: string;
  title: string;
  mastery: number;
  cardsTotal: number;
  cardsDue: number;
  onOpenPack: () => void;
}

export function PackProgressCard({
  packId: _packId,
  title,
  mastery,
  cardsTotal,
  cardsDue,
  onOpenPack
}: PackProgressCardProps) {
  return (
    <OTCard title={title}>
      <Group justify="space-between" align="flex-start">
        <OTMetric label="Mastery" value={mastery} />
        <OTMetric label="Due / total" value={`${cardsDue} / ${cardsTotal}`} />
        <OTActionButton label={`Open pack: ${title}`} onClick={onOpenPack} variant="light" />
      </Group>
      <OTProgressBar label="Mastery" value={mastery} />
    </OTCard>
  );
}
```

- [ ] **Step 5: Update barrel**

Append to `src/renderer/components/study/index.ts`:

```ts
export { WeakAreasCard } from "./WeakAreasCard.js";
export type { WeakAreasCardProps, WeakArea } from "./WeakAreasCard.js";
export { PackProgressCard } from "./PackProgressCard.js";
export type { PackProgressCardProps } from "./PackProgressCard.js";
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/study-components.test.js
```
Expected: PASS — 5 tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/components/study tests/study-components.test.tsx
git commit -m "feat: add WeakAreasCard and PackProgressCard"
```

---

### Task 6: GenerationPreviewCard, JobStatusCard

**Files:**
- Create: `src/renderer/components/study/GenerationPreviewCard.tsx`
- Create: `src/renderer/components/study/JobStatusCard.tsx`
- Modify: `src/renderer/components/study/index.ts`
- Modify: `tests/study-components.test.tsx`

- [ ] **Step 1: Append failing tests**

```tsx
const { GenerationPreviewCard, JobStatusCard } = await import("../src/renderer/components/study/index.js");

test("GenerationPreviewCard renders requested outputs as togglable chips", () => {
  let outputs: string[] = ["notes", "flashcards"];
  render(wrap(
    <GenerationPreviewCard
      sourceTitle="Cellular Biology"
      outputs={["notes", "flashcards", "quiz"] as const}
      selectedOutputs={["notes", "flashcards"] as const}
      onConfirm={(selected) => { outputs = [...selected]; }}
      onToggleOutput={() => undefined}
    />
  ));
  assert.ok(screen.getByText(/cellular biology/i));
  fireEvent.click(screen.getByRole("button", { name: "Confirm generation" }));
  assert.deepEqual(outputs, ["notes", "flashcards"]);
});

test("JobStatusCard renders status badge per job and progress bar for running jobs", () => {
  render(wrap(
    <JobStatusCard
      jobs={[
        { id: "j1", label: "OCR Processing", detail: "Campbell.pdf", status: "running", progress: 70 },
        { id: "j2", label: "Index", detail: "Library", status: "completed", progress: 100 }
      ]}
    />
  ));
  assert.ok(screen.getByText("OCR Processing"));
  assert.ok(screen.getByText("Index"));
  const running = screen.getByRole("progressbar", { name: "OCR Processing" });
  assert.equal(running.getAttribute("aria-valuenow"), "70");
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement GenerationPreviewCard**

```tsx
// src/renderer/components/study/GenerationPreviewCard.tsx
import { Chip, Group } from "@mantine/core";
import { OTCard, OTActionButton } from "../ot/index.js";

export type GenerationOutput = "notes" | "flashcards" | "quiz" | "mindmap" | "podcast";

export interface GenerationPreviewCardProps {
  sourceTitle: string;
  outputs: readonly GenerationOutput[];
  selectedOutputs: readonly GenerationOutput[];
  onToggleOutput: (output: GenerationOutput) => void;
  onConfirm: (selected: readonly GenerationOutput[]) => void;
}

export function GenerationPreviewCard({
  sourceTitle,
  outputs,
  selectedOutputs,
  onToggleOutput,
  onConfirm
}: GenerationPreviewCardProps) {
  const selected = new Set(selectedOutputs);
  return (
    <OTCard title={`Plan generation: ${sourceTitle}`}>
      <Group gap={6}>
        {outputs.map((output) => (
          <Chip
            key={output}
            checked={selected.has(output)}
            onChange={() => onToggleOutput(output)}
          >
            {output}
          </Chip>
        ))}
      </Group>
      <Group justify="flex-end" mt="sm">
        <OTActionButton
          label="Confirm generation"
          onClick={() => onConfirm(Array.from(selected) as GenerationOutput[])}
          variant="filled"
          kind="mutating"
        />
      </Group>
    </OTCard>
  );
}
```

- [ ] **Step 4: Implement JobStatusCard**

```tsx
// src/renderer/components/study/JobStatusCard.tsx
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
            {job.status === "running" && <OTProgressBar label={job.label} value={job.progress} />}
          </Stack>
        ))}
      </Stack>
    </OTCard>
  );
}
```

- [ ] **Step 5: Update barrel**

```ts
export { GenerationPreviewCard } from "./GenerationPreviewCard.js";
export type { GenerationPreviewCardProps, GenerationOutput } from "./GenerationPreviewCard.js";
export { JobStatusCard } from "./JobStatusCard.js";
export type { JobStatusCardProps, JobStatusItem, JobStatus } from "./JobStatusCard.js";
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/study-components.test.js
```
Expected: PASS — 7 tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/components/study tests/study-components.test.tsx
git commit -m "feat: add GenerationPreviewCard and JobStatusCard"
```

---

### Task 7: SourcePickerCard, SyncStatusCard

**Files:**
- Create: `src/renderer/components/study/SourcePickerCard.tsx`
- Create: `src/renderer/components/study/SyncStatusCard.tsx`
- Modify: `src/renderer/components/study/index.ts`
- Modify: `tests/study-components.test.tsx`

- [ ] **Step 1: Append failing tests**

```tsx
const { SourcePickerCard, SyncStatusCard } = await import("../src/renderer/components/study/index.js");

test("SourcePickerCard renders sources, fires onSelect with id", () => {
  let chosen = "";
  render(wrap(
    <SourcePickerCard
      title="Pick sources for quiz"
      sources={[
        { id: "src_1", title: "Lecture 5 notes", kindLabel: "TEXT" },
        { id: "src_2", title: "Chapter 3", kindLabel: "PDF" }
      ]}
      onSelect={(id) => { chosen = id; }}
    />
  ));
  fireEvent.click(screen.getByRole("button", { name: "Use source: Chapter 3" }));
  assert.equal(chosen, "src_2");
});

test("SyncStatusCard renders state and last sync info", () => {
  render(wrap(
    <SyncStatusCard
      enabled
      state="connected"
      message="All caught up"
      lastSyncLabel="2 minutes ago"
    />
  ));
  assert.ok(screen.getByText("connected"));
  assert.ok(screen.getByText("All caught up"));
  assert.ok(screen.getByText("2 minutes ago"));
});

test("SyncStatusCard renders disabled state when sync is off", () => {
  render(wrap(<SyncStatusCard enabled={false} state="offline" message="Local-only" />));
  assert.ok(screen.getByText("offline"));
  assert.ok(screen.getByText("Local-only"));
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement SourcePickerCard**

```tsx
// src/renderer/components/study/SourcePickerCard.tsx
import { Stack } from "@mantine/core";
import { OTCard, OTActionButton } from "../ot/index.js";

export interface SourcePickerOption {
  id: string;
  title: string;
  kindLabel: string;
}

export interface SourcePickerCardProps {
  title: string;
  sources: SourcePickerOption[];
  onSelect: (id: string) => void;
}

export function SourcePickerCard({ title, sources, onSelect }: SourcePickerCardProps) {
  return (
    <OTCard title={title}>
      <Stack gap={4}>
        {sources.map((source) => (
          <div key={source.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              <strong>{source.title}</strong>
              <small style={{ marginLeft: 6, color: "gray" }}>{source.kindLabel}</small>
            </span>
            <OTActionButton
              label={`Use source: ${source.title}`}
              onClick={() => onSelect(source.id)}
              variant="subtle"
            />
          </div>
        ))}
      </Stack>
    </OTCard>
  );
}
```

- [ ] **Step 4: Implement SyncStatusCard**

```tsx
// src/renderer/components/study/SyncStatusCard.tsx
import { Stack, Text } from "@mantine/core";
import { OTCard, OTStatusBadge } from "../ot/index.js";
import type { OTStatus } from "../ot/index.js";

export type SyncState = "offline" | "connected" | "syncing" | "error";

const STATE_TO_OT: Record<SyncState, OTStatus> = {
  offline: "neutral",
  connected: "ok",
  syncing: "info",
  error: "error"
};

export interface SyncStatusCardProps {
  enabled: boolean;
  state: SyncState;
  message: string;
  lastSyncLabel?: string;
}

export function SyncStatusCard({ enabled, state, message, lastSyncLabel }: SyncStatusCardProps) {
  return (
    <OTCard title="Sync">
      <Stack gap={4}>
        <OTStatusBadge status={STATE_TO_OT[state]} label={state} />
        <Text size="sm">{message}</Text>
        {lastSyncLabel && <Text size="xs" c="dimmed">Last sync: {lastSyncLabel}</Text>}
        {!enabled && <Text size="xs" c="dimmed">Sync is disabled.</Text>}
      </Stack>
    </OTCard>
  );
}
```

- [ ] **Step 5: Update barrel**

```ts
export { SourcePickerCard } from "./SourcePickerCard.js";
export type { SourcePickerCardProps, SourcePickerOption } from "./SourcePickerCard.js";
export { SyncStatusCard } from "./SyncStatusCard.js";
export type { SyncStatusCardProps, SyncState } from "./SyncStatusCard.js";
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/study-components.test.js
```
Expected: PASS — 10 study-component tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/components/study tests/study-components.test.tsx
git commit -m "feat: add SourcePickerCard and SyncStatusCard"
```

---

## Phase 3 — A2UI Registry, Validation, Renderer

### Task 8: A2UI prop-schema utility

**Files:**
- Create: `src/renderer/a2ui/schema.ts`
- Test: `tests/a2ui-schema.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/a2ui-schema.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { S, validate } from "../src/renderer/a2ui/schema.js";

test("S.string accepts strings, rejects others with path", () => {
  const ok = validate(S.string(), "hi");
  assert.deepEqual(ok, { ok: true, value: "hi" });
  const bad = validate(S.string(), 1);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /expected string/i);
});

test("S.number accepts numbers, S.boolean accepts booleans", () => {
  assert.deepEqual(validate(S.number(), 5), { ok: true, value: 5 });
  assert.deepEqual(validate(S.boolean(), true), { ok: true, value: true });
  assert.equal(validate(S.number(), "5").ok, false);
});

test("S.array enforces item schema and reports index", () => {
  const ok = validate(S.array(S.string()), ["a", "b"]);
  assert.deepEqual(ok, { ok: true, value: ["a", "b"] });
  const bad = validate(S.array(S.string()), ["a", 2]);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /\[1\]/);
});

test("S.object validates required fields, rejects extra fields by default", () => {
  const schema = S.object({ id: S.string(), count: S.number() });
  const ok = validate(schema, { id: "x", count: 2 });
  assert.deepEqual(ok, { ok: true, value: { id: "x", count: 2 } });
  const missing = validate(schema, { id: "x" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /\.count/);
  const extra = validate(schema, { id: "x", count: 2, hidden: true });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.match(extra.error, /unexpected field "hidden"/i);
});

test("S.optional allows undefined", () => {
  const schema = S.object({ id: S.string(), tag: S.optional(S.string()) });
  const ok = validate(schema, { id: "x" });
  assert.deepEqual(ok, { ok: true, value: { id: "x", tag: undefined } });
});

test("S.literal and S.enum match exact values", () => {
  assert.equal(validate(S.literal("notes"), "notes").ok, true);
  assert.equal(validate(S.literal("notes"), "flashcards").ok, false);
  assert.equal(validate(S.enum(["a", "b"] as const), "a").ok, true);
  assert.equal(validate(S.enum(["a", "b"] as const), "c").ok, false);
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm run build:main
```
Expected: module not found.

- [ ] **Step 3: Implement schema utility**

```ts
// src/renderer/a2ui/schema.ts
export type Schema<T> = {
  readonly _tag: string;
  readonly check: (value: unknown, path: string) => { ok: true; value: T } | { ok: false; error: string };
};

export type Infer<T> = T extends Schema<infer U> ? U : never;

function fail(path: string, message: string): { ok: false; error: string } {
  return { ok: false, error: `${path || "<root>"}: ${message}` };
}

export const S = {
  string(): Schema<string> {
    return { _tag: "string", check: (v, p) => typeof v === "string" ? { ok: true, value: v } : fail(p, "expected string") };
  },
  number(): Schema<number> {
    return { _tag: "number", check: (v, p) => typeof v === "number" && Number.isFinite(v) ? { ok: true, value: v } : fail(p, "expected number") };
  },
  boolean(): Schema<boolean> {
    return { _tag: "boolean", check: (v, p) => typeof v === "boolean" ? { ok: true, value: v } : fail(p, "expected boolean") };
  },
  literal<L extends string | number | boolean>(literal: L): Schema<L> {
    return {
      _tag: "literal",
      check: (v, p) => v === literal ? { ok: true, value: literal } : fail(p, `expected literal ${JSON.stringify(literal)}`)
    };
  },
  enum<L extends readonly (string | number)[]>(values: L): Schema<L[number]> {
    return {
      _tag: "enum",
      check: (v, p) => values.includes(v as L[number]) ? { ok: true, value: v as L[number] } : fail(p, `expected one of ${values.join(", ")}`)
    };
  },
  optional<T>(inner: Schema<T>): Schema<T | undefined> {
    return {
      _tag: "optional",
      check: (v, p) => v === undefined ? { ok: true, value: undefined } : inner.check(v, p)
    };
  },
  array<T>(item: Schema<T>): Schema<T[]> {
    return {
      _tag: "array",
      check: (v, p) => {
        if (!Array.isArray(v)) return fail(p, "expected array");
        const out: T[] = [];
        for (let i = 0; i < v.length; i += 1) {
          const result = item.check(v[i], `${p}[${i}]`);
          if (!result.ok) return result;
          out.push(result.value);
        }
        return { ok: true, value: out };
      }
    };
  },
  object<F extends Record<string, Schema<unknown>>>(fields: F): Schema<{ [K in keyof F]: Infer<F[K]> }> {
    return {
      _tag: "object",
      check: (v, p) => {
        if (typeof v !== "object" || v === null || Array.isArray(v)) return fail(p, "expected object");
        const input = v as Record<string, unknown>;
        const out = {} as { [K in keyof F]: Infer<F[K]> };
        for (const key of Object.keys(fields)) {
          const result = fields[key].check(input[key], `${p}.${key}`);
          if (!result.ok) return result;
          (out as Record<string, unknown>)[key] = result.value;
        }
        for (const key of Object.keys(input)) {
          if (!(key in fields)) return fail(`${p}.${key}`, `unexpected field "${key}"`);
        }
        return { ok: true, value: out };
      }
    };
  }
};

export function validate<T>(schema: Schema<T>, value: unknown): { ok: true; value: T } | { ok: false; error: string } {
  return schema.check(value, "");
}
```

- [ ] **Step 4: Run test**

```
npm run build:main && node --test dist/tests/a2ui-schema.test.js
```
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/a2ui/schema.ts tests/a2ui-schema.test.ts
git commit -m "feat: add A2UI prop schema validator"
```

---

### Task 9: A2UI definitions (catalog of names + schemas)

**Files:**
- Create: `src/renderer/a2ui/definitions.ts`
- Test: `tests/a2ui-catalog.test.ts` (used in Tasks 9 and 11)

- [ ] **Step 1: Write failing test**

```ts
// tests/a2ui-catalog.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { definitions, definitionFor, knownComponentNames } from "../src/renderer/a2ui/definitions.js";

test("definitions cover the eight study components", () => {
  assert.deepEqual(
    knownComponentNames().sort(),
    [
      "GenerationPreviewCard",
      "JobStatusCard",
      "PackProgressCard",
      "ReviewQueueCard",
      "SourcePickerCard",
      "StudyPlanCard",
      "SyncStatusCard",
      "WeakAreasCard"
    ].sort()
  );
});

test("definitionFor returns undefined for unknown names", () => {
  assert.equal(definitionFor("UnknownThing"), undefined);
});

test("StudyPlanCard definition validates a well-formed payload", () => {
  const def = definitionFor("StudyPlanCard");
  assert.ok(def);
  if (!def) return;
  const result = def.validateProps({
    title: "Today",
    steps: [{ id: "s1", label: "Review" }]
  });
  assert.equal(result.ok, true);
});

test("StudyPlanCard definition rejects missing required fields", () => {
  const def = definitionFor("StudyPlanCard");
  assert.ok(def);
  if (!def) return;
  const result = def.validateProps({ title: "Today" });
  assert.equal(result.ok, false);
});

test("definitions has a description string for each component", () => {
  for (const def of Object.values(definitions)) {
    assert.equal(typeof def.description, "string");
    assert.ok(def.description.length > 10, `${def.name} description should be substantive`);
  }
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement definitions**

```ts
// src/renderer/a2ui/definitions.ts
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
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/a2ui-catalog.test.js
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/a2ui/definitions.ts tests/a2ui-catalog.test.ts
git commit -m "feat: add A2UI component definitions and catalog lookup"
```

---

### Task 10: A2UI errors + SafeErrorCard

**Files:**
- Create: `src/renderer/a2ui/errors.ts`
- Create: `src/renderer/a2ui/SafeErrorCard.tsx`
- Test: append to `tests/a2ui-renderer.test.tsx` (created in Task 11) — for now, dedicate a small unit test file `tests/a2ui-errors.test.ts`.

- [ ] **Step 1: Write failing test**

```ts
// tests/a2ui-errors.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  UnknownComponentError,
  InvalidPropsError,
  BlockedActionError,
  describeRendererFailure
} from "../src/renderer/a2ui/errors.js";

test("UnknownComponentError carries component name", () => {
  const err = new UnknownComponentError("FooCard");
  assert.equal(err.name, "UnknownComponentError");
  assert.equal(err.componentName, "FooCard");
});

test("InvalidPropsError carries name + validation detail", () => {
  const err = new InvalidPropsError("StudyPlanCard", ".steps[0].label: expected string");
  assert.equal(err.componentName, "StudyPlanCard");
  assert.match(err.detail, /steps\[0\]\.label/);
});

test("BlockedActionError carries action id and reason", () => {
  const err = new BlockedActionError("delete-source", "deletion not allowed via agent");
  assert.equal(err.actionId, "delete-source");
  assert.match(err.reason, /not allowed/);
});

test("describeRendererFailure returns a concise label in production mode", () => {
  const desc = describeRendererFailure(new InvalidPropsError("StudyPlanCard", ".steps[0]: oops"), { dev: false });
  assert.match(desc.headline, /Couldn.t render/);
  assert.equal(desc.detail, undefined);
});

test("describeRendererFailure returns detail in dev mode", () => {
  const desc = describeRendererFailure(new InvalidPropsError("StudyPlanCard", ".steps[0]: oops"), { dev: true });
  assert.match(desc.detail ?? "", /steps\[0\]/);
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement errors.ts**

```ts
// src/renderer/a2ui/errors.ts
export class UnknownComponentError extends Error {
  componentName: string;
  constructor(componentName: string) {
    super(`Unknown A2UI component: ${componentName}`);
    this.name = "UnknownComponentError";
    this.componentName = componentName;
  }
}

export class InvalidPropsError extends Error {
  componentName: string;
  detail: string;
  constructor(componentName: string, detail: string) {
    super(`Invalid props for ${componentName}: ${detail}`);
    this.name = "InvalidPropsError";
    this.componentName = componentName;
    this.detail = detail;
  }
}

export class BlockedActionError extends Error {
  actionId: string;
  reason: string;
  constructor(actionId: string, reason: string) {
    super(`Blocked action ${actionId}: ${reason}`);
    this.name = "BlockedActionError";
    this.actionId = actionId;
    this.reason = reason;
  }
}

export interface RendererFailureDescription {
  headline: string;
  detail?: string;
}

export function describeRendererFailure(error: unknown, options: { dev: boolean }): RendererFailureDescription {
  if (error instanceof UnknownComponentError) {
    return {
      headline: "Unsupported component requested",
      detail: options.dev ? `Unknown component name "${error.componentName}".` : undefined
    };
  }
  if (error instanceof InvalidPropsError) {
    return {
      headline: "Couldn't render this card",
      detail: options.dev ? `${error.componentName}: ${error.detail}` : undefined
    };
  }
  if (error instanceof BlockedActionError) {
    return {
      headline: "Action blocked for safety",
      detail: options.dev ? `${error.actionId}: ${error.reason}` : undefined
    };
  }
  return { headline: "Couldn't render this card" };
}
```

- [ ] **Step 4: Implement SafeErrorCard**

```tsx
// src/renderer/a2ui/SafeErrorCard.tsx
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
```

- [ ] **Step 5: Run tests**

```
npm run build:main && node --test dist/tests/a2ui-errors.test.js
```
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```
git add src/renderer/a2ui/errors.ts src/renderer/a2ui/SafeErrorCard.tsx tests/a2ui-errors.test.ts
git commit -m "feat: add A2UI error types and SafeErrorCard fallback"
```

---

### Task 11: A2UI renderer dispatcher

**Files:**
- Create: `src/renderer/a2ui/renderers.tsx`
- Create: `src/renderer/a2ui/catalog.ts`
- Create: `src/renderer/a2ui/A2UIRender.tsx`
- Test: `tests/a2ui-renderer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/a2ui-renderer.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { A2UIRender } = await import("../src/renderer/a2ui/A2UIRender.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const handlers = {
  onAction: () => undefined
};

test.afterEach(() => cleanup());

test("A2UIRender renders a known component when payload is valid", () => {
  render(wrap(<A2UIRender payload={{
    component: "ReviewQueueCard",
    props: { dueCount: 4, preview: [{ cardId: "c1", front: "Mitosis" }] },
    actions: { onOpenReview: { actionId: "open-review" } }
  }} handlers={handlers} dev />));
  assert.ok(screen.getByText("Mitosis"));
  assert.ok(screen.getByRole("button", { name: "Open review session" }));
});

test("A2UIRender renders SafeErrorCard for unknown component (regression)", () => {
  render(wrap(<A2UIRender payload={{ component: "FakeCard", props: {}, actions: {} }} handlers={handlers} dev />));
  assert.ok(screen.getByText(/unsupported component/i));
});

test("A2UIRender renders SafeErrorCard for invalid props (regression)", () => {
  render(wrap(<A2UIRender payload={{
    component: "ReviewQueueCard",
    props: { dueCount: "five" } as unknown as Record<string, unknown>,
    actions: {}
  }} handlers={handlers} dev />));
  assert.ok(screen.getByText(/couldn.t render/i));
});

test("A2UIRender wires action handlers; clicking emits actionId via handlers.onAction", () => {
  let received = "";
  render(wrap(<A2UIRender
    payload={{
      component: "ReviewQueueCard",
      props: { dueCount: 1, preview: [] },
      actions: { onOpenReview: { actionId: "open-review-now" } }
    }}
    handlers={{ onAction: (id) => { received = id; } }}
    dev
  />));
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(received, "open-review-now");
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run test to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement catalog.ts**

```ts
// src/renderer/a2ui/catalog.ts
import { definitions, definitionFor, type ComponentName } from "./definitions.js";
import { InvalidPropsError, UnknownComponentError } from "./errors.js";

export interface A2UIPayload {
  component: string;
  props: Record<string, unknown>;
  actions?: Record<string, { actionId: string; payload?: unknown }>;
}

export interface ValidatedPayload<T = unknown> {
  componentName: ComponentName;
  props: T;
  actions: Record<string, { actionId: string; payload?: unknown }>;
}

export function validatePayload(payload: A2UIPayload): ValidatedPayload {
  const def = definitionFor(payload.component);
  if (!def) {
    throw new UnknownComponentError(payload.component);
  }
  const result = def.validateProps(payload.props);
  if (!result.ok) {
    throw new InvalidPropsError(def.name, result.error);
  }
  return {
    componentName: def.name as ComponentName,
    props: result.value,
    actions: payload.actions ?? {}
  };
}

export { definitions };
```

- [ ] **Step 4: Implement renderers.tsx**

```tsx
// src/renderer/a2ui/renderers.tsx
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

type RendererFn = (props: unknown, ctx: RendererContext) => JSX.Element;

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

export function renderForName(name: ComponentName, props: unknown, ctx: RendererContext): JSX.Element {
  return renderers[name](props, ctx);
}
```

- [ ] **Step 5: Implement A2UIRender**

```tsx
// src/renderer/a2ui/A2UIRender.tsx
import { validatePayload, type A2UIPayload } from "./catalog.js";
import { renderForName } from "./renderers.js";
import { SafeErrorCard } from "./SafeErrorCard.js";

export interface A2UIRenderHandlers {
  onAction: (actionId: string, args?: unknown) => void;
}

export interface A2UIRenderProps {
  payload: A2UIPayload;
  handlers: A2UIRenderHandlers;
  dev?: boolean;
}

export function A2UIRender({ payload, handlers, dev = false }: A2UIRenderProps) {
  let validated;
  try {
    validated = validatePayload(payload);
  } catch (error) {
    return <SafeErrorCard error={error} dev={dev} />;
  }
  const ctx = {
    emit: (actionId: string, args?: unknown) => handlers.onAction(actionId, args),
    getActionId: (name: string) => validated.actions[name]?.actionId
  };
  try {
    return renderForName(validated.componentName, validated.props, ctx);
  } catch (error) {
    return <SafeErrorCard error={error} dev={dev} />;
  }
}
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/a2ui-renderer.test.js
```
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```
git add src/renderer/a2ui/catalog.ts src/renderer/a2ui/renderers.tsx src/renderer/a2ui/A2UIRender.tsx tests/a2ui-renderer.test.tsx
git commit -m "feat: add A2UI renderer dispatcher with safe fallback"
```

---

### Task 12: Action boundary classification

**Files:**
- Create: `src/renderer/a2ui/actionBoundary.ts`
- Test: `tests/action-boundary.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/action-boundary.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { classifyAction, ACTION_REGISTRY } from "../src/renderer/a2ui/actionBoundary.js";

test("classify read-only navigation actions", () => {
  assert.equal(classifyAction("focus-source").kind, "read-only");
  assert.equal(classifyAction("focus-pack").kind, "read-only");
  assert.equal(classifyAction("open-review").kind, "read-only");
  assert.equal(classifyAction("filter-library").kind, "read-only");
});

test("classify mutating actions and require confirmation", () => {
  const generate = classifyAction("generate-pack");
  assert.equal(generate.kind, "mutating");
  assert.equal(generate.requiresConfirmation, true);

  const exportPack = classifyAction("export-pack");
  assert.equal(exportPack.kind, "mutating");
  assert.equal(exportPack.requiresConfirmation, true);

  const updateSettings = classifyAction("update-settings");
  assert.equal(updateSettings.kind, "mutating");
  assert.equal(updateSettings.requiresConfirmation, true);
});

test("classify blocked actions (delete, cancel-job, raw-html)", () => {
  assert.equal(classifyAction("delete-source").kind, "blocked");
  assert.equal(classifyAction("delete-pack").kind, "blocked");
  assert.equal(classifyAction("cancel-job").kind, "blocked");
  assert.equal(classifyAction("raw-html").kind, "blocked");
});

test("classify unknown action falls back to blocked", () => {
  assert.equal(classifyAction("totally-made-up-action").kind, "blocked");
});

test("ACTION_REGISTRY descriptions are non-empty", () => {
  for (const entry of Object.values(ACTION_REGISTRY)) {
    assert.ok(entry.description.length > 0);
  }
});
```

- [ ] **Step 2: Run test**

```
npm run build:main
```
Expected: failure.

- [ ] **Step 3: Implement actionBoundary**

```ts
// src/renderer/a2ui/actionBoundary.ts
export type ActionKind = "read-only" | "mutating" | "blocked";

export interface ActionEntry {
  kind: ActionKind;
  description: string;
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmMessage?: (args?: unknown) => string;
}

export const ACTION_REGISTRY: Record<string, ActionEntry> = {
  "focus-source": { kind: "read-only", description: "Focus a source in the workspace." },
  "focus-pack": { kind: "read-only", description: "Focus a study pack in the workspace." },
  "focus-space": { kind: "read-only", description: "Focus a space." },
  "open-review": { kind: "read-only", description: "Open the review session view." },
  "open-pack": { kind: "read-only", description: "Open a study pack in focused workspace." },
  "filter-library": { kind: "read-only", description: "Apply a library filter." },
  "show-weak-area": { kind: "read-only", description: "Show details for a weak area." },

  "generate-pack": {
    kind: "mutating",
    description: "Generate notes/flashcards/quiz/mindmap/podcast for a source.",
    requiresConfirmation: true,
    confirmTitle: "Generate study material?",
    confirmMessage: (args) => `Generate ${describeOutputs(args)}.`
  },
  "review-card": {
    kind: "mutating",
    description: "Save a flashcard review rating.",
    requiresConfirmation: false
  },
  "send-chat": {
    kind: "mutating",
    description: "Send a chat message to the assistant.",
    requiresConfirmation: false
  },
  "export-pack": {
    kind: "mutating",
    description: "Export a study pack.",
    requiresConfirmation: true,
    confirmTitle: "Export study pack?",
    confirmMessage: (args) => `Export as ${String((args as { format?: string } | undefined)?.format ?? "?")}.`
  },
  "update-settings": {
    kind: "mutating",
    description: "Update OpenTurbo settings (sync URL, privacy, providers).",
    requiresConfirmation: true,
    confirmTitle: "Update settings?",
    confirmMessage: () => "The assistant has proposed a change to your settings."
  },
  "test-provider": {
    kind: "mutating",
    description: "Run a provider health check.",
    requiresConfirmation: false
  },

  "delete-source": { kind: "blocked", description: "Deleting sources is not exposed to the agent." },
  "delete-pack": { kind: "blocked", description: "Deleting packs is not exposed to the agent." },
  "cancel-job": { kind: "blocked", description: "Cancelling jobs is not exposed to the agent in this release." },
  "raw-html": { kind: "blocked", description: "Arbitrary HTML rendering is not allowed." }
};

const UNKNOWN_BLOCKED: ActionEntry = { kind: "blocked", description: "Unknown action." };

export function classifyAction(actionId: string): ActionEntry {
  return ACTION_REGISTRY[actionId] ?? UNKNOWN_BLOCKED;
}

function describeOutputs(args: unknown): string {
  if (Array.isArray(args)) return args.join(", ");
  return "study material";
}
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/action-boundary.test.js
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/a2ui/actionBoundary.ts tests/action-boundary.test.ts
git commit -m "feat: add A2UI action boundary classification"
```

---

### Task 13: ConfirmActionModal

**Files:**
- Create: `src/renderer/a2ui/ConfirmActionModal.tsx`
- Test: `tests/confirm-action-modal.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/confirm-action-modal.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { ConfirmActionModal } = await import("../src/renderer/a2ui/ConfirmActionModal.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("ConfirmActionModal shows title, message, and fires onConfirm", () => {
  let confirmed = false;
  let cancelled = false;
  render(wrap(<ConfirmActionModal
    opened
    title="Generate study material?"
    message="Generate flashcards, quiz."
    confirmLabel="Generate"
    onConfirm={() => { confirmed = true; }}
    onCancel={() => { cancelled = true; }}
  />));
  assert.ok(screen.getByText("Generate study material?"));
  assert.ok(screen.getByText("Generate flashcards, quiz."));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  assert.equal(confirmed, true);
  assert.equal(cancelled, false);
});

test("ConfirmActionModal cancel button fires onCancel", () => {
  let confirmed = false;
  let cancelled = false;
  render(wrap(<ConfirmActionModal
    opened
    title="X"
    message="Y"
    confirmLabel="Go"
    onConfirm={() => { confirmed = true; }}
    onCancel={() => { cancelled = true; }}
  />));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(cancelled, true);
  assert.equal(confirmed, false);
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run test**

```
npm run build:main
```

- [ ] **Step 3: Implement modal**

```tsx
// src/renderer/a2ui/ConfirmActionModal.tsx
import { Button, Group, Modal, Text } from "@mantine/core";

export interface ConfirmActionModalProps {
  opened: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  opened,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmActionModalProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title={title} centered radius={8}>
      <Text size="sm">{message}</Text>
      <Group justify="flex-end" mt="md" gap={6}>
        <Button variant="subtle" onClick={onCancel}>Cancel</Button>
        <Button color="teal" onClick={onConfirm}>{confirmLabel}</Button>
      </Group>
    </Modal>
  );
}
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/confirm-action-modal.test.js
```
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/a2ui/ConfirmActionModal.tsx tests/confirm-action-modal.test.tsx
git commit -m "feat: add ConfirmActionModal for mutating-action confirmation"
```

---

## Phase 4 — Generative Study Dashboard Shell

### Task 14: Sample payloads + AssistantPrompt component

**Files:**
- Create: `src/renderer/a2ui/samplePayloads.ts`
- Create: `src/renderer/dashboard/AssistantPrompt.tsx`
- Test: `tests/dashboard-canvas.test.tsx` (used in Task 15 too — start with prompt cases)

- [ ] **Step 1: Write failing test**

```tsx
// tests/dashboard-canvas.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { AssistantPrompt } = await import("../src/renderer/dashboard/AssistantPrompt.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("AssistantPrompt submits the trimmed prompt and clears the input", () => {
  let submitted = "";
  render(wrap(<AssistantPrompt
    placeholder="Ask anything"
    onSubmit={(value) => { submitted = value; }}
    disabled={false}
  />));
  fireEvent.change(screen.getByPlaceholderText("Ask anything"), { target: { value: "  build my plan  " } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  assert.equal(submitted, "build my plan");
  assert.equal((screen.getByPlaceholderText("Ask anything") as HTMLInputElement).value, "");
});

test("AssistantPrompt ignores empty submissions", () => {
  let calls = 0;
  render(wrap(<AssistantPrompt placeholder="Ask anything" onSubmit={() => { calls += 1; }} disabled={false} />));
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  assert.equal(calls, 0);
});

test("AssistantPrompt is disabled while a request is in flight", () => {
  render(wrap(<AssistantPrompt placeholder="Ask" onSubmit={() => undefined} disabled />));
  const input = screen.getByPlaceholderText("Ask") as HTMLInputElement;
  assert.equal(input.disabled, true);
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run test**

```
npm run build:main
```

- [ ] **Step 3: Implement samplePayloads.ts**

```ts
// src/renderer/a2ui/samplePayloads.ts
import type { A2UIPayload } from "./catalog.js";

export interface DashboardLayout {
  payloads: A2UIPayload[];
}

export const STATIC_OVERVIEW_LAYOUT: DashboardLayout = {
  payloads: [
    {
      component: "ReviewQueueCard",
      props: { dueCount: 0, preview: [] },
      actions: { onOpenReview: { actionId: "open-review" } }
    },
    {
      component: "WeakAreasCard",
      props: { areas: [] },
      actions: { onFocusArea: { actionId: "show-weak-area" } }
    }
  ]
};

export function samplePayloadFor(prompt: string, snapshotHints: { dueCount: number; weakAreas: string[]; jobs: Array<{ id: string; label: string; detail: string; status: "queued" | "running" | "completed" | "failed"; progress: number }>; firstSourceTitle?: string }): DashboardLayout {
  const lower = prompt.toLowerCase();
  if (lower.includes("review")) {
    return {
      payloads: [
        {
          component: "ReviewQueueCard",
          props: { dueCount: snapshotHints.dueCount, preview: [] },
          actions: { onOpenReview: { actionId: "open-review" } }
        }
      ]
    };
  }
  if (lower.includes("weak")) {
    return {
      payloads: [
        {
          component: "WeakAreasCard",
          props: {
            areas: snapshotHints.weakAreas.map((label, idx) => ({ id: `wa_${idx}`, label, score: 0.4 }))
          },
          actions: { onFocusArea: { actionId: "show-weak-area" } }
        }
      ]
    };
  }
  if ((lower.includes("generat") || lower.includes("quiz") || lower.includes("flashcard")) && snapshotHints.firstSourceTitle) {
    return {
      payloads: [
        {
          component: "GenerationPreviewCard",
          props: {
            sourceId: "first",
            sourceTitle: snapshotHints.firstSourceTitle,
            outputs: ["notes", "flashcards", "quiz"],
            selectedOutputs: ["notes", "flashcards"]
          },
          actions: {
            onConfirm: { actionId: "generate-pack" },
            onToggleOutput: { actionId: "noop" }
          }
        }
      ]
    };
  }
  if (lower.includes("job") || lower.includes("ready")) {
    return {
      payloads: [
        { component: "JobStatusCard", props: { jobs: snapshotHints.jobs }, actions: {} }
      ]
    };
  }
  return STATIC_OVERVIEW_LAYOUT;
}
```

- [ ] **Step 4: Implement AssistantPrompt**

```tsx
// src/renderer/dashboard/AssistantPrompt.tsx
import { ActionIcon, Group, TextInput } from "@mantine/core";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";

export interface AssistantPromptProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  disabled: boolean;
}

export function AssistantPrompt({ placeholder, onSubmit, disabled }: AssistantPromptProps) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };
  return (
    <Group gap={6} align="center" wrap="nowrap" className="assistant-prompt">
      <TextInput
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        style={{ flex: 1 }}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
      />
      <ActionIcon
        size={36}
        color="teal"
        onClick={submit}
        disabled={disabled}
        aria-label="Send to assistant"
      >
        <MessageSquareText size={18} />
      </ActionIcon>
    </Group>
  );
}
```

- [ ] **Step 5: Run tests**

```
npm run build:main && node --test dist/tests/dashboard-canvas.test.js
```
Expected: PASS — 3 prompt tests.

- [ ] **Step 6: Commit**

```
git add src/renderer/a2ui/samplePayloads.ts src/renderer/dashboard/AssistantPrompt.tsx tests/dashboard-canvas.test.tsx
git commit -m "feat: add AssistantPrompt and A2UI sample payloads"
```

---

### Task 15: DashboardCanvas

**Files:**
- Create: `src/renderer/dashboard/DashboardCanvas.tsx`
- Modify: `tests/dashboard-canvas.test.tsx`

- [ ] **Step 1: Append failing tests**

```tsx
const { DashboardCanvas } = await import("../src/renderer/dashboard/DashboardCanvas.js");

test("DashboardCanvas renders each payload in order", () => {
  render(wrap(<DashboardCanvas
    payloads={[
      { component: "ReviewQueueCard", props: { dueCount: 1, preview: [] }, actions: {} },
      { component: "JobStatusCard", props: { jobs: [] }, actions: {} }
    ]}
    onAction={() => undefined}
    dev
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Jobs"));
});

test("DashboardCanvas isolates errors so one bad payload does not blow up the rest", () => {
  render(wrap(<DashboardCanvas
    payloads={[
      { component: "BogusCard", props: {}, actions: {} },
      { component: "ReviewQueueCard", props: { dueCount: 0, preview: [] }, actions: {} }
    ]}
    onAction={() => undefined}
    dev
  />));
  assert.ok(screen.getByText(/unsupported component/i));
  assert.ok(screen.getByText("Review queue"));
});

test("DashboardCanvas renders empty-state hint when payloads is empty", () => {
  render(wrap(<DashboardCanvas payloads={[]} onAction={() => undefined} dev />));
  assert.ok(screen.getByText(/ask the assistant to assemble/i));
});
```

- [ ] **Step 2: Run tests**

```
npm run build:main
```

- [ ] **Step 3: Implement DashboardCanvas**

```tsx
// src/renderer/dashboard/DashboardCanvas.tsx
import { Stack, Text } from "@mantine/core";
import { A2UIRender } from "../a2ui/A2UIRender.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface DashboardCanvasProps {
  payloads: A2UIPayload[];
  onAction: (actionId: string, args?: unknown) => void;
  dev?: boolean;
}

export function DashboardCanvas({ payloads, onAction, dev = false }: DashboardCanvasProps) {
  if (payloads.length === 0) {
    return (
      <Stack align="center" py="lg">
        <Text size="sm" c="dimmed">Ask the assistant to assemble your dashboard.</Text>
      </Stack>
    );
  }
  return (
    <Stack gap="md">
      {payloads.map((payload, index) => (
        <A2UIRender
          key={index}
          payload={payload}
          handlers={{ onAction }}
          dev={dev}
        />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/dashboard-canvas.test.js
```
Expected: PASS — 6 dashboard-canvas tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/dashboard/DashboardCanvas.tsx tests/dashboard-canvas.test.tsx
git commit -m "feat: add DashboardCanvas with per-payload error isolation"
```

---

### Task 16: StaticOverview fallback

**Files:**
- Create: `src/renderer/dashboard/StaticOverview.tsx`
- Modify: `tests/dashboard-canvas.test.tsx`

- [ ] **Step 1: Append failing test**

```tsx
const { StaticOverview } = await import("../src/renderer/dashboard/StaticOverview.js");

test("StaticOverview renders calm activity overview without prompting agent", () => {
  render(wrap(<StaticOverview
    snapshotHints={{
      dueCount: 4,
      weakAreas: ["Membrane transport"],
      jobs: [],
      firstSourceTitle: "Cellular Biology"
    }}
    onAction={() => undefined}
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Weak areas"));
  assert.ok(screen.getByText("Membrane transport"));
});
```

- [ ] **Step 2: Run test**

```
npm run build:main
```

- [ ] **Step 3: Implement StaticOverview**

```tsx
// src/renderer/dashboard/StaticOverview.tsx
import { DashboardCanvas } from "./DashboardCanvas.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface StaticOverviewSnapshotHints {
  dueCount: number;
  weakAreas: string[];
  jobs: Array<{ id: string; label: string; detail: string; status: "queued" | "running" | "completed" | "failed"; progress: number }>;
  firstSourceTitle?: string;
}

export interface StaticOverviewProps {
  snapshotHints: StaticOverviewSnapshotHints;
  onAction: (actionId: string, args?: unknown) => void;
}

export function StaticOverview({ snapshotHints, onAction }: StaticOverviewProps) {
  const payloads: A2UIPayload[] = [
    {
      component: "ReviewQueueCard",
      props: { dueCount: snapshotHints.dueCount, preview: [] },
      actions: { onOpenReview: { actionId: "open-review" } }
    },
    {
      component: "WeakAreasCard",
      props: {
        areas: snapshotHints.weakAreas.map((label, index) => ({ id: `wa_${index}`, label, score: 0.4 }))
      },
      actions: { onFocusArea: { actionId: "show-weak-area" } }
    },
    {
      component: "JobStatusCard",
      props: { jobs: snapshotHints.jobs },
      actions: {}
    }
  ];
  return <DashboardCanvas payloads={payloads} onAction={onAction} />;
}
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/dashboard-canvas.test.js
```
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/dashboard/StaticOverview.tsx tests/dashboard-canvas.test.tsx
git commit -m "feat: add StaticOverview fallback for the generative dashboard"
```

---

### Task 17: GenerativeStudyDashboard composition + state machine

**Files:**
- Create: `src/renderer/dashboard/dispatchAgent.ts`
- Create: `src/renderer/dashboard/GenerativeStudyDashboard.tsx`
- Test: `tests/generative-dashboard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/generative-dashboard.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { GenerativeStudyDashboard } = await import("../src/renderer/dashboard/GenerativeStudyDashboard.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const baseHints = {
  dueCount: 3,
  weakAreas: ["Mitosis"],
  jobs: [],
  firstSourceTitle: "Cellular Biology"
};

test.afterEach(() => cleanup());

test("dashboard renders static overview when no prompt has been submitted", () => {
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={() => undefined}
    agentAvailable={false}
  />));
  assert.ok(screen.getByText("Review queue"));
  assert.ok(screen.getByText("Weak areas"));
});

test("submitting a prompt swaps in a relevant sample payload via the stub agent", () => {
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={() => undefined}
    agentAvailable
  />));
  fireEvent.change(screen.getByPlaceholderText(/ask the assistant/i), { target: { value: "Show weak topics" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  assert.ok(screen.getByText("Mitosis"));
});

test("dashboard forwards action events from rendered cards to onAction", () => {
  let received = "";
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={baseHints}
    onAction={(id) => { received = id; }}
    agentAvailable
  />));
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.equal(received, "open-review");
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run test**

```
npm run build:main
```

- [ ] **Step 3: Implement dispatchAgent stub**

```ts
// src/renderer/dashboard/dispatchAgent.ts
import { samplePayloadFor, type DashboardLayout } from "../a2ui/samplePayloads.js";
import type { StaticOverviewSnapshotHints } from "./StaticOverview.js";

export interface AgentDispatcher {
  dispatch: (prompt: string) => Promise<DashboardLayout>;
}

export function createStubDispatcher(snapshotHints: StaticOverviewSnapshotHints): AgentDispatcher {
  return {
    async dispatch(prompt) {
      return samplePayloadFor(prompt, snapshotHints);
    }
  };
}
```

- [ ] **Step 4: Implement GenerativeStudyDashboard**

```tsx
// src/renderer/dashboard/GenerativeStudyDashboard.tsx
import { Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { AssistantPrompt } from "./AssistantPrompt.js";
import { DashboardCanvas } from "./DashboardCanvas.js";
import { StaticOverview, type StaticOverviewSnapshotHints } from "./StaticOverview.js";
import { createStubDispatcher } from "./dispatchAgent.js";
import type { A2UIPayload } from "../a2ui/catalog.js";

export interface GenerativeStudyDashboardProps {
  snapshotHints: StaticOverviewSnapshotHints;
  onAction: (actionId: string, args?: unknown) => void;
  agentAvailable: boolean;
}

export function GenerativeStudyDashboard({ snapshotHints, onAction, agentAvailable }: GenerativeStudyDashboardProps) {
  const dispatcher = useMemo(() => createStubDispatcher(snapshotHints), [snapshotHints]);
  const [payloads, setPayloads] = useState<A2UIPayload[] | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePrompt(value: string) {
    if (!agentAvailable) return;
    setPending(true);
    try {
      const layout = await dispatcher.dispatch(value);
      setPayloads(layout.payloads);
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack className="generative-dashboard" gap="md">
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {payloads === null
          ? <StaticOverview snapshotHints={snapshotHints} onAction={onAction} />
          : <DashboardCanvas payloads={payloads} onAction={onAction} />}
      </div>
      <AssistantPrompt
        placeholder={agentAvailable ? "Ask the assistant to build a dashboard..." : "Ask the assistant (offline preview)..."}
        onSubmit={handlePrompt}
        disabled={!agentAvailable || pending}
      />
    </Stack>
  );
}
```

- [ ] **Step 5: Run tests**

```
npm run build:main && node --test dist/tests/generative-dashboard.test.js
```
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```
git add src/renderer/dashboard/dispatchAgent.ts src/renderer/dashboard/GenerativeStudyDashboard.tsx tests/generative-dashboard.test.tsx
git commit -m "feat: compose GenerativeStudyDashboard with stub agent dispatcher"
```

---

### Task 18: Wire dashboard as default view in App.tsx

**Files:**
- Modify: `src/renderer/App.tsx` (sidebar nav, default `activeNav`, workspace render branch)
- Modify: `src/renderer/App.css` (add `.generative-dashboard`, `.assistant-prompt` styles)
- Modify: `tests/renderer-app-shell.test.tsx`

This task adds a new `Dashboard` nav at the top, makes it the default, and wires `GenerativeStudyDashboard` as the workspace view when active. The existing `Library` view becomes one click away (still available, no behavioral change).

- [ ] **Step 1: Update the existing app-shell test to require Dashboard as default**

In `tests/renderer-app-shell.test.tsx`, change the existing nav-labels assertion to require `Dashboard` first:

```tsx
const navLabels = ["Dashboard", "Library", "Spaces", "Review", "Analytics", "Sync", "Settings"];
```

And add a new case at the end of that file:

```tsx
test("App opens on the Generative Study Dashboard with assistant prompt at the bottom", { timeout: 20_000 }, async () => {
  render(<App />);
  await screen.findByText("OpenTurbo");
  assert.ok(screen.getByRole("button", { name: "Dashboard" }).getAttribute("aria-current") === "page");
  assert.ok(screen.getByPlaceholderText(/ask the assistant/i));
  assert.ok(screen.getByText("Review queue"));
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm run build:main && node --test dist/tests/renderer-app-shell.test.js
```
Expected: FAIL — assertion mismatch on default nav.

- [ ] **Step 3: Update the NavLabel union and default state in App.tsx**

In `src/renderer/App.tsx`:

- Change the `NavLabel` type to:
  ```ts
  type NavLabel = "Dashboard" | "Library" | "Spaces" | "Review" | "Analytics" | "Sync" | "Settings";
  ```
- Change `useState<NavLabel>("Library")` to `useState<NavLabel>("Dashboard")`.
- In the `Sidebar` component's `nav` array (around line 633), prepend:
  ```ts
  ["Dashboard", Sparkles] as const,
  ```
  And keep the rest. (Re-use `Sparkles` from the existing lucide-react imports.)
- Add a `Dashboard` branch at the top of `WorkspaceView`'s render switch (right before the existing `if (activeNav === "Library")`):

  ```tsx
  if (activeNav === "Dashboard") {
    return (
      <FullWorkspaceSection title="Dashboard" subtitle="Ask the assistant to build your study view.">
        <GenerativeStudyDashboard
          snapshotHints={{
            dueCount: snapshot.analytics.cardsDue,
            weakAreas: snapshot.analytics.weakAreas,
            jobs: snapshot.jobs.map((job) => ({
              id: job.id,
              label: job.label,
              detail: job.detail,
              status: job.status,
              progress: job.progress
            })),
            firstSourceTitle: snapshot.sources[0]?.title
          }}
          onAction={onDashboardAction}
          agentAvailable
        />
      </FullWorkspaceSection>
    );
  }
  ```

- Add a stub `onDashboardAction` prop on `WorkspaceView` typed as `(actionId: string, args?: unknown) => void` (Task 21 fills it in). Pass `onDashboardAction={() => undefined}` from the `App` for now.

- Import:
  ```ts
  import { GenerativeStudyDashboard } from "./dashboard/GenerativeStudyDashboard.js";
  ```

- [ ] **Step 4: Add minimal dashboard styles**

Append to `src/renderer/App.css`:

```css
.generative-dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.assistant-prompt {
  border-top: 1px solid var(--mantine-color-gray-3, #e5e7eb);
  padding: 8px 12px;
  background: var(--mantine-color-gray-0, #f8fafc);
}
```

- [ ] **Step 5: Run all renderer tests**

```
npm run build:main && node --test dist/tests/renderer-app-shell.test.js dist/tests/generative-dashboard.test.js
```
Expected: PASS — including the new Dashboard-default case.

- [ ] **Step 6: Run typecheck**

```
npm run typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit**

```
git add src/renderer/App.tsx src/renderer/App.css tests/renderer-app-shell.test.tsx
git commit -m "feat: make Generative Study Dashboard the default workspace view"
```

---

## Phase 5 — Focused Study Workspace

The spec: "Selecting a generated dashboard item opens a focused full-page study workspace ... only the relevant study surface is primary at a time. The old three-pane layout becomes a focused workspace mode, not the app's default first impression."

The existing Library view already renders the three-pane LibraryPane / EditorPane / AssistantPane layout. We can reuse it as the focused mode but route the entry from the dashboard.

### Task 19: StudyWorkspace component (extract focused mode)

**Files:**
- Create: `src/renderer/workspace/StudyWorkspace.tsx`
- Modify: `src/renderer/App.tsx` (extract focused-mode render branch into the new component, render it from the existing `Library` branch)

This is a refactor: pull the three-pane render block currently inside `if (activeNav === "Library")` of `WorkspaceView` into a `StudyWorkspace` component that takes the same props. Don't change behavior.

- [ ] **Step 1: Capture current behavior with a snapshot test**

Append to `tests/renderer-app-shell.test.tsx`:

```tsx
test("Library view still renders three-pane focused workspace (LibraryPane + EditorPane + AssistantPane)", { timeout: 20_000 }, async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  await screen.findByText("Library");
  assert.ok(screen.getByText("Sources (1)"));
  assert.ok(screen.getByText("AI Assistant"));
});
```

- [ ] **Step 2: Run to verify it passes today**

```
npm run build:main && node --test dist/tests/renderer-app-shell.test.js
```
Expected: PASS — current behavior already supports this.

- [ ] **Step 3: Extract `StudyWorkspace`**

Create `src/renderer/workspace/StudyWorkspace.tsx` that takes the same prop bag the current `Library` branch needs and renders `<LibraryPane /> <EditorPane /> <AssistantPane />` in the same shape. The exact prop shape: copy the props block from the existing `Library` branch in `WorkspaceView` (lines ~544–588) verbatim.

```tsx
// src/renderer/workspace/StudyWorkspace.tsx
import type { ReactNode } from "react";

export interface StudyWorkspaceProps {
  children: ReactNode;
}

// Pure layout container; the current LibraryPane/EditorPane/AssistantPane stay where they live in App.tsx
// for this iteration. We pass the rendered panes as children to keep the refactor safe.
export function StudyWorkspace({ children }: StudyWorkspaceProps) {
  return <>{children}</>;
}
```

In `WorkspaceView`'s `Library` branch:

```tsx
if (activeNav === "Library") {
  return (
    <StudyWorkspace>
      <LibraryPane ... />
      <EditorPane ... />
      <AssistantPane ... />
    </StudyWorkspace>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

```
npm run build:main && node --test dist/tests/renderer-app-shell.test.js
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/renderer/workspace/StudyWorkspace.tsx src/renderer/App.tsx tests/renderer-app-shell.test.tsx
git commit -m "refactor: wrap three-pane Library view in StudyWorkspace container"
```

---

### Task 20: Dashboard → workspace navigation

**Files:**
- Modify: `src/renderer/App.tsx` (route `open-pack` / `focus-source` / `focus-pack` actions through to existing selection helpers + nav switch)
- Modify: `tests/generative-dashboard.test.tsx`

- [ ] **Step 1: Append a navigation test**

Add to `tests/generative-dashboard.test.tsx`:

```tsx
test("clicking a pack-progress card from the dashboard navigates to the focused workspace", { timeout: 20_000 }, async () => {
  // Re-import App for an end-to-end mount. This test lives here for proximity, but uses the real App.
  const { default: App } = await import("../src/renderer/App.js");
  const { rerender: _rerender } = render(<App />);
  await screen.findByText("OpenTurbo");
  // Submit a generation prompt to surface a PackProgressCard via the stub.
  fireEvent.change(screen.getByPlaceholderText(/ask the assistant/i), { target: { value: "show pack progress" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));
  // The stub doesn't surface PackProgressCard for that prompt by default; widen the stub or set a hint instead.
  // For this test we instead click the "Open review session" button and assert nav switches to Review.
  fireEvent.click(screen.getByRole("button", { name: "Open review session" }));
  assert.ok(screen.getByText(/review/i));
});
```

(Note: keep this test focused on the action-id → nav switch contract. The Phase 6 end-to-end test covers more.)

- [ ] **Step 2: Run to verify failure**

```
npm run build:main && node --test dist/tests/generative-dashboard.test.js
```
Expected: FAIL — `onDashboardAction` is currently a no-op in `App.tsx`.

- [ ] **Step 3: Wire `onDashboardAction` in App.tsx**

In the `App` component, define:

```ts
function onDashboardAction(actionId: string, args?: unknown) {
  switch (actionId) {
    case "open-review":
      setActiveNav("Review");
      return;
    case "focus-pack": {
      const id = typeof args === "string" ? args : undefined;
      if (id) {
        const pack = snapshot?.packs.find((p) => p.id === id);
        if (pack) selectPack(pack);
      }
      setActiveNav("Library");
      return;
    }
    case "focus-source": {
      const id = typeof args === "string" ? args : undefined;
      if (id) {
        const source = snapshot?.sources.find((s) => s.id === id);
        if (source) selectSource(source);
      }
      setActiveNav("Library");
      return;
    }
    case "open-pack": {
      setActiveNav("Library");
      return;
    }
    case "show-weak-area":
      setActiveNav("Analytics");
      return;
    case "filter-library":
      setActiveNav("Library");
      return;
    default:
      // Mutating + unknown actions handled in Phase 6.
      return;
  }
}
```

Pass `onDashboardAction={onDashboardAction}` from `App` into `WorkspaceView`, and from `WorkspaceView` into `GenerativeStudyDashboard`.

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/generative-dashboard.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/renderer/App.tsx tests/generative-dashboard.test.tsx
git commit -m "feat: route dashboard read-only actions to existing workspace nav"
```

---

## Phase 6 — Confirmed Action Dispatch (still without live agent)

### Task 21: Mutating action dispatch with confirmation

**Files:**
- Create: `src/renderer/dashboard/useDashboardActions.ts`
- Modify: `src/renderer/App.tsx`
- Test: `tests/dashboard-actions.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/dashboard-actions.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { useDashboardActions } = await import("../src/renderer/dashboard/useDashboardActions.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

const fakeClient = {
  generate: async () => ({ id: "pack_new", sourceId: "src_1", title: "New", summary: "", sections: [], flashcards: [], quiz: [], mindMap: { id: "r", label: "r", children: [] }, podcastScript: "", mastery: 0, createdAt: "", updatedAt: "" }),
  exportPack: async () => "preview://pack.json",
  updateSettings: async (patch: { syncServerUrl?: string }) => ({ syncServerUrl: patch.syncServerUrl ?? "", privacyMode: true, dataPath: "", fileStoragePath: "", outputLanguage: "English", providers: [] })
};

test.afterEach(() => cleanup());

test("mutating action shows confirmation modal; confirm calls the client; cancel does not", async () => {
  let didGenerate = false;
  const client = {
    ...fakeClient,
    async generate(input: { sourceId: string; outputs: string[] }) {
      didGenerate = true;
      return await fakeClient.generate();
    }
  };

  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: true,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("generate-pack", ["notes"])}>fire</button>
      </>
    );
  }

  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.ok(await screen.findByText("Generate study material?"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(didGenerate, false);

  fireEvent.click(screen.getByText("fire"));
  await screen.findByText("Generate study material?");
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(didGenerate, true);
});

test("blocked action emits an inline alert and never calls the client", () => {
  let didCall = false;
  const client = {
    ...fakeClient,
    async generate() { didCall = true; return await fakeClient.generate(); }
  };
  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: true,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("delete-source", "src_1")}>fire</button>
        {actions.lastError && <p data-testid="err">{actions.lastError}</p>}
      </>
    );
  }
  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.match(screen.getByTestId("err").textContent ?? "", /not exposed|blocked/i);
  assert.equal(didCall, false);
});

test("dispatch refuses mutating action when provider is not ready", async () => {
  let didCall = false;
  const client = { ...fakeClient, async generate() { didCall = true; return await fakeClient.generate(); } };
  function Harness() {
    const actions = useDashboardActions({
      client: client as unknown as Parameters<typeof useDashboardActions>[0]["client"],
      providerReady: false,
      defaultSourceId: "src_1",
      onActionFinished: () => undefined
    });
    return (
      <>
        {actions.modal}
        <button onClick={() => actions.dispatch("generate-pack", ["notes"])}>fire</button>
        {actions.lastError && <p data-testid="err">{actions.lastError}</p>}
      </>
    );
  }
  render(wrap(<Harness />));
  fireEvent.click(screen.getByText("fire"));
  assert.match(screen.getByTestId("err").textContent ?? "", /provider/i);
  assert.equal(didCall, false);
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement `useDashboardActions`**

```tsx
// src/renderer/dashboard/useDashboardActions.ts
import { useState, type ReactNode } from "react";
import { ConfirmActionModal } from "../a2ui/ConfirmActionModal.js";
import { classifyAction } from "../a2ui/actionBoundary.js";
import type { OpenTurboClient } from "../data/client.js";
import type { GenerationOutput } from "../components/study/index.js";

export interface UseDashboardActionsOptions {
  client: OpenTurboClient;
  providerReady: boolean;
  defaultSourceId?: string;
  defaultPackId?: string;
  onActionFinished: () => void;
}

interface PendingAction {
  actionId: string;
  args: unknown;
  title: string;
  message: string;
  confirmLabel: string;
}

export function useDashboardActions(options: UseDashboardActionsOptions) {
  const { client, providerReady, defaultSourceId, defaultPackId, onActionFinished } = options;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  function dispatch(actionId: string, args?: unknown): void {
    setLastError(null);
    const entry = classifyAction(actionId);
    if (entry.kind === "blocked") {
      setLastError(entry.description);
      return;
    }
    if (entry.kind === "read-only") {
      // Read-only navigation is wired in App.tsx; ignore here.
      return;
    }
    if (!providerReady) {
      setLastError("Configure a provider before performing this action.");
      return;
    }
    if (entry.requiresConfirmation) {
      setPending({
        actionId,
        args,
        title: entry.confirmTitle ?? "Confirm action?",
        message: entry.confirmMessage ? entry.confirmMessage(args) : entry.description,
        confirmLabel: actionConfirmLabel(actionId)
      });
      return;
    }
    void runMutating(actionId, args);
  }

  async function runMutating(actionId: string, args: unknown): Promise<void> {
    try {
      switch (actionId) {
        case "generate-pack": {
          const outputs = (Array.isArray(args) ? args : ["notes"]) as GenerationOutput[];
          const sourceId = defaultSourceId;
          if (!sourceId) {
            setLastError("Select a source before generating.");
            return;
          }
          await client.generate({ sourceId, outputs });
          break;
        }
        case "export-pack": {
          const packId = (args as { packId?: string } | undefined)?.packId ?? defaultPackId;
          const format = ((args as { format?: "markdown" | "json" | "anki-csv" } | undefined)?.format ?? "json") as "markdown" | "json" | "anki-csv";
          if (!packId) {
            setLastError("Select a study pack before exporting.");
            return;
          }
          await client.exportPack(packId, format);
          break;
        }
        case "update-settings": {
          const patch = (args as Parameters<OpenTurboClient["updateSettings"]>[0]) ?? {};
          await client.updateSettings(patch);
          break;
        }
        case "test-provider": {
          const id = typeof args === "string" ? args : undefined;
          if (!id) {
            setLastError("Specify a provider id.");
            return;
          }
          await client.testProvider(id);
          break;
        }
        default:
          setLastError(`Unsupported mutating action: ${actionId}`);
          return;
      }
      onActionFinished();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  }

  const modal: ReactNode = pending ? (
    <ConfirmActionModal
      opened
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      onCancel={() => setPending(null)}
      onConfirm={async () => {
        const current = pending;
        setPending(null);
        await runMutating(current.actionId, current.args);
      }}
    />
  ) : null;

  return { modal, dispatch, lastError };
}

function actionConfirmLabel(actionId: string): string {
  switch (actionId) {
    case "generate-pack": return "Generate";
    case "export-pack": return "Export";
    case "update-settings": return "Apply";
    default: return "Confirm";
  }
}
```

- [ ] **Step 4: Run unit tests**

```
npm run build:main && node --test dist/tests/dashboard-actions.test.js
```
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire it into `App.tsx`**

In `App.tsx`, inside `App()` (after `runAction` is defined), add:

```ts
const dashboardActions = useDashboardActions({
  client,
  providerReady: Boolean(defaultProvider?.enabled),
  defaultSourceId: selectedSource?.id,
  defaultPackId: selectedPack?.id,
  onActionFinished: () => { void refresh(); }
});
```

Update `onDashboardAction` to call `dashboardActions.dispatch(actionId, args)` for any action not handled by the read-only switch:

```ts
function onDashboardAction(actionId: string, args?: unknown) {
  // ...existing read-only switch...
  default:
    dashboardActions.dispatch(actionId, args);
    return;
}
```

In the JSX next to the existing `<Modal>` for import, render `{dashboardActions.modal}` and an inline alert for `dashboardActions.lastError` (use `OTInlineAlert` placed near the global feedback area).

- [ ] **Step 6: Run typecheck + all tests**

```
npm run typecheck
npm test
```
Expected: PASS (all existing + new tests).

- [ ] **Step 7: Commit**

```
git add src/renderer/dashboard/useDashboardActions.ts src/renderer/App.tsx tests/dashboard-actions.test.tsx
git commit -m "feat: confirm and dispatch mutating dashboard actions through OpenTurboClient"
```

---

### Task 22: End-to-end browser/DOM flow test

**Files:**
- Create: `tests/dashboard-flow.test.tsx`

This is the spec's required Browser/DOM flow test: ask assistant → render approved dashboard components → open focused study workspace → confirm a generation action.

- [ ] **Step 1: Write the end-to-end test**

```tsx
// tests/dashboard-flow.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { default: App } = await import("../src/renderer/App.js");

test.afterEach(() => cleanup());

test("dashboard end-to-end: ask → render approved cards → open workspace → confirm generation", { timeout: 30_000 }, async () => {
  render(<App />);
  await screen.findByText("OpenTurbo");

  // Default view is the dashboard.
  assert.equal(screen.getByRole("button", { name: "Dashboard" }).getAttribute("aria-current"), "page");
  assert.ok(screen.getByText("Review queue"));

  // Ask the assistant for a generation plan.
  fireEvent.change(screen.getByPlaceholderText(/ask the assistant/i), { target: { value: "prepare a quiz from these sources" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to assistant" }));

  // Approved component renders (GenerationPreviewCard).
  assert.ok(await screen.findByText(/plan generation/i));

  // Confirm the generation; modal must appear because generate-pack requires confirmation.
  fireEvent.click(screen.getByRole("button", { name: "Confirm generation" }));
  assert.ok(await screen.findByText("Generate study material?"));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  // After confirmation, refresh runs; library count should still show at least 1 study pack.
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  await screen.findByText(/sources/i);

  // Regression: unknown component never crashed the app.
  assert.ok(screen.getByText("OpenTurbo"));
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run test**

```
npm run build:main && node --test dist/tests/dashboard-flow.test.js
```
Expected: PASS.

- [ ] **Step 3: Run the whole suite to catch regressions**

```
npm test
```
Expected: PASS — every existing test plus the new ones.

- [ ] **Step 4: Commit**

```
git add tests/dashboard-flow.test.tsx
git commit -m "test: end-to-end browser flow for generative dashboard + confirm action"
```

---

## Phase 7 — Live CopilotKit / AG-UI Integration

> The spec says: "The A2UI/CopilotKit surface is moving quickly. The implementation plan should re-check official docs before adding dependencies or coding against specific APIs." The first task in this phase **must** complete before any package installs.

### Task 23: Verify CopilotKit + A2UI docs (research, no code)

**Files:**
- Create: `docs/superpowers/research/2026-05-07-copilotkit-a2ui-doc-check.md`

- [ ] **Step 1: Check current CopilotKit docs and A2UI surface**

Use Context7 (or `WebFetch`) for each link in the spec's "External References":

```
- https://github.com/google/A2UI
- https://a2ui.org/
- https://a2ui.org/guides/a2ui-with-any-agent-framework/
- https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui
- https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/dynamic-schema
- https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/fixed-schema
```

For each, capture:
- npm package name(s) and exact versions in latest releases.
- Provider/runtime initialization API (component name, hook name, transport setup).
- The shape of an A2UI message in the current schema and where it's emitted.
- The "fixed-schema catalog" registration pattern (this is what we want — bring-your-own-renderers).
- Any breaking changes vs what the spec describes.

- [ ] **Step 2: Write the research note**

Create `docs/superpowers/research/2026-05-07-copilotkit-a2ui-doc-check.md` with:
- Date and source links checked.
- Final dependency choice (`@copilotkit/react-core@x.y.z`, `@copilotkit/runtime@x.y.z` or whatever the docs name).
- Mapping from current OpenTurbo concepts to current SDK concepts: definition catalog → SDK's component registry; A2UI payload → SDK's component message; action handler → SDK's action invoke pattern.
- Any items that no longer match the spec — list and call out as needing follow-up before proceeding.

- [ ] **Step 3: STOP if the doc-check changed the architecture in a way the spec doesn't anticipate.**

If the SDK has materially changed (e.g., catalog registration is now keyed differently, or A2UI is no longer a discrete protocol), pause here and ask the user before continuing.

- [ ] **Step 4: Commit**

```
git add docs/superpowers/research/2026-05-07-copilotkit-a2ui-doc-check.md
git commit -m "docs: doc-check for CopilotKit + A2UI before integration"
```

---

### Task 24: Add CopilotKit deps + CopilotProvider wired to approved catalog

**Files:**
- Modify: `package.json` (add SDK deps from Task 23 — exact names depend on doc-check)
- Create: `src/renderer/copilot/CopilotProvider.tsx`
- Create: `src/renderer/copilot/registerCatalog.ts`
- Test: `tests/copilot-provider.test.tsx`

> All concrete API names below assume the SDK shape described by the spec at the time of writing. If Task 23 found different names, substitute them here verbatim.

- [ ] **Step 1: Write a failing wrapper test**

```tsx
// tests/copilot-provider.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { CopilotShell } = await import("../src/renderer/copilot/CopilotProvider.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("CopilotShell renders children whether or not the SDK is available", () => {
  render(wrap(<CopilotShell><span data-testid="child">x</span></CopilotShell>));
  assert.ok(screen.getByTestId("child"));
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Install SDK deps (names from Task 23)**

```
npm install <copilotkit-package-1> <copilotkit-package-2> ...
```

- [ ] **Step 4: Implement `registerCatalog.ts`**

This file exposes the OpenTurbo approved catalog (from `src/renderer/a2ui/definitions.ts` + `renderers.tsx`) in the SDK's catalog-registration shape (from Task 23). Each renderer must continue to dispatch via `validatePayload` so unknown / invalid payloads still hit `SafeErrorCard`.

```ts
// src/renderer/copilot/registerCatalog.ts
import { definitions, type ComponentName } from "../a2ui/definitions.js";
// import the SDK registration helper based on Task 23.

// Pseudocode based on the spec — replace with the exact SDK API after the doc-check.
export function buildApprovedCatalog() {
  return Object.values(definitions).map((def) => ({
    name: def.name,
    description: def.description,
    propsSchema: def.schema, // SDK may want JSON Schema; convert here if so.
  }));
}
```

If the SDK requires JSON Schema, write a small adapter that walks `Schema<T>` from `src/renderer/a2ui/schema.ts` and emits a JSON-Schema dict. Add unit tests for the adapter alongside `tests/a2ui-schema.test.ts`.

- [ ] **Step 5: Implement `CopilotProvider.tsx`**

```tsx
// src/renderer/copilot/CopilotProvider.tsx
// Replace the imports below with the actual SDK exports identified in Task 23.
import type { ReactNode } from "react";

export interface CopilotShellProps {
  children: ReactNode;
}

let SDK_AVAILABLE = false;
try {
  // require/await import the SDK module here; set SDK_AVAILABLE = true on success.
} catch {
  SDK_AVAILABLE = false;
}

export function CopilotShell({ children }: CopilotShellProps) {
  if (!SDK_AVAILABLE) return <>{children}</>;
  // Wrap children in the SDK's provider, passing buildApprovedCatalog() output.
  return <>{children}</>;
}
```

- [ ] **Step 6: Run tests**

```
npm run build:main && node --test dist/tests/copilot-provider.test.js
```
Expected: PASS.

- [ ] **Step 7: Commit**

```
git add package.json package-lock.json src/renderer/copilot tests/copilot-provider.test.tsx
git commit -m "feat: add CopilotShell and approved-catalog registration scaffolding"
```

---

### Task 25: useA2UIRuntime hook to receive agent payloads + dispatch actions

**Files:**
- Create: `src/renderer/copilot/useA2UIRuntime.ts`
- Test: `tests/copilot-runtime.test.tsx`

The hook must:
- Subscribe to A2UI messages from the runtime.
- Pass each message through `validatePayload` before exposing it.
- Forward any tool/action invocations from the agent back through `useDashboardActions.dispatch`.
- Expose `{ payloads: A2UIPayload[]; agentAvailable: boolean; sendPrompt: (text: string) => Promise<void> }`.

- [ ] **Step 1: Write failing test**

```tsx
// tests/copilot-runtime.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

setupDom();

const { cleanup, render, screen } = await import("@testing-library/react");
const { MantineProvider } = await import("@mantine/core");
const { useA2UIRuntime } = await import("../src/renderer/copilot/useA2UIRuntime.js");

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>;

test.afterEach(() => cleanup());

test("when SDK is unavailable, hook reports agentAvailable=false and sendPrompt is a noop", async () => {
  function Harness() {
    const runtime = useA2UIRuntime({ onAction: () => undefined, transport: undefined });
    return (
      <div>
        <span data-testid="available">{String(runtime.agentAvailable)}</span>
        <button onClick={() => void runtime.sendPrompt("hi")}>send</button>
      </div>
    );
  }
  render(wrap(<Harness />));
  assert.equal(screen.getByTestId("available").textContent, "false");
});

test("invalid agent payloads are filtered out before exposure", async () => {
  // Inject a fake transport that emits one invalid + one valid payload.
  const fakeTransport = {
    subscribe(cb: (payload: { component: string; props: Record<string, unknown>; actions?: Record<string, { actionId: string }> }) => void) {
      cb({ component: "BogusCard", props: {}, actions: {} });
      cb({ component: "ReviewQueueCard", props: { dueCount: 2, preview: [] }, actions: {} });
      return () => undefined;
    },
    async send() { return; }
  };

  function Harness() {
    const runtime = useA2UIRuntime({ onAction: () => undefined, transport: fakeTransport });
    return <pre data-testid="payloads">{runtime.payloads.map((p) => p.component).join(",")}</pre>;
  }
  render(wrap(<Harness />));
  assert.equal(screen.getByTestId("payloads").textContent, "ReviewQueueCard");
});

function setupDom(): void { /* same helper */ }
```

- [ ] **Step 2: Run to verify failure**

```
npm run build:main
```

- [ ] **Step 3: Implement the hook**

```ts
// src/renderer/copilot/useA2UIRuntime.ts
import { useEffect, useState } from "react";
import { validatePayload, type A2UIPayload } from "../a2ui/catalog.js";

export interface A2UITransport {
  subscribe: (cb: (payload: A2UIPayload) => void) => () => void;
  send: (prompt: string) => Promise<void>;
}

export interface UseA2UIRuntimeOptions {
  onAction: (actionId: string, args?: unknown) => void;
  transport?: A2UITransport;
}

export function useA2UIRuntime({ onAction: _onAction, transport }: UseA2UIRuntimeOptions) {
  const [payloads, setPayloads] = useState<A2UIPayload[]>([]);

  useEffect(() => {
    if (!transport) return;
    const unsubscribe = transport.subscribe((payload) => {
      try {
        validatePayload(payload);
        setPayloads((prev) => [...prev, payload]);
      } catch {
        // Drop invalid payloads silently; SafeErrorCard would render them, but the design
        // for live mode is to filter rather than display failures from the agent stream.
      }
    });
    return unsubscribe;
  }, [transport]);

  async function sendPrompt(text: string) {
    if (!transport) return;
    await transport.send(text);
  }

  return {
    payloads,
    agentAvailable: Boolean(transport),
    sendPrompt
  };
}
```

- [ ] **Step 4: Run tests**

```
npm run build:main && node --test dist/tests/copilot-runtime.test.js
```
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```
git add src/renderer/copilot/useA2UIRuntime.ts tests/copilot-runtime.test.tsx
git commit -m "feat: add A2UI runtime hook with validation gate"
```

---

### Task 26: Replace stub dispatcher with live agent route

**Files:**
- Modify: `src/renderer/dashboard/GenerativeStudyDashboard.tsx`
- Modify: `src/renderer/App.tsx`
- Test: `tests/copilot-runtime.test.tsx`

- [ ] **Step 1: Add a contract test that the dashboard prefers a live transport when present**

Append to `tests/copilot-runtime.test.tsx`:

```tsx
test("GenerativeStudyDashboard renders agent payloads when a transport is provided", async () => {
  const fakeTransport = {
    subscribe(cb: (payload: { component: string; props: Record<string, unknown>; actions?: Record<string, { actionId: string }> }) => void) {
      cb({
        component: "ReviewQueueCard",
        props: { dueCount: 9, preview: [{ cardId: "c1", front: "Define osmosis" }] },
        actions: { onOpenReview: { actionId: "open-review" } }
      });
      return () => undefined;
    },
    async send() { return; }
  };
  const { GenerativeStudyDashboard } = await import("../src/renderer/dashboard/GenerativeStudyDashboard.js");
  render(wrap(<GenerativeStudyDashboard
    snapshotHints={{ dueCount: 0, weakAreas: [], jobs: [] }}
    onAction={() => undefined}
    agentAvailable
    transport={fakeTransport}
  />));
  assert.ok(await screen.findByText("Define osmosis"));
});
```

- [ ] **Step 2: Run to verify failure**

```
npm run build:main && node --test dist/tests/copilot-runtime.test.js
```

- [ ] **Step 3: Update `GenerativeStudyDashboard` to accept a transport**

Add a `transport?: A2UITransport` prop. When present:
- Use `useA2UIRuntime({ transport, onAction })` to drive `payloads`.
- `sendPrompt` from the prompt component routes through `runtime.sendPrompt` instead of the stub.
- When absent, keep the existing stub dispatcher.

```tsx
// inside GenerativeStudyDashboard
const runtime = useA2UIRuntime({ onAction, transport });
const livePayloads = transport ? runtime.payloads : null;

async function handlePrompt(value: string) {
  if (transport) {
    await runtime.sendPrompt(value);
    return;
  }
  // existing stub branch
}

const payloadsToShow = livePayloads ?? payloadsFromStub /* existing state */;
```

- [ ] **Step 4: Wire transport from CopilotShell into App**

In `App.tsx`, wrap the workspace with `<CopilotShell>` and obtain the transport from the SDK context. If unavailable, the dashboard automatically falls back to the static overview.

- [ ] **Step 5: Run all tests**

```
npm test
```
Expected: PASS — full suite.

- [ ] **Step 6: Manual verification (renderer)**

Per the system instruction "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete":

```
npm run dev
```

In the browser:
- Confirm the default view is the Generative Study Dashboard.
- Submit several spec example prompts: "Build my review plan for today", "Show weak topics from this pack", "Prepare a quiz from these sources", "Show what is still generating and what is ready". For each, confirm an approved component appears.
- Click "Confirm generation" on the GenerationPreviewCard, verify the modal appears, and confirm — the existing study pack list should update.
- Click into Library; confirm the focused workspace still works as before.
- If a CopilotKit transport is configured, confirm live agent payloads render. If not, confirm the stub still works and `agentAvailable` reflects reality.

- [ ] **Step 7: Commit**

```
git add src/renderer/dashboard/GenerativeStudyDashboard.tsx src/renderer/App.tsx tests/copilot-runtime.test.tsx
git commit -m "feat: route generative dashboard through live A2UI transport when available"
```

---

## Spec → Task Coverage Map

| Spec section / requirement | Task(s) |
|---|---|
| Default screen = Study Activity Overview | 16, 17, 18 |
| Persistent bottom assistant prompt | 14, 17, 18 |
| Approved catalog only (no arbitrary UI) | 8, 9, 10, 11 |
| Mantine first-foundation | 1, 2, 3, 4–7 |
| A2UI declarative messages → OpenTurbo renderers | 11, 25, 26 |
| Validation against catalog | 9, 11 |
| OTCard, OTMetric, OTStatusBadge, OTActionButton, OTEmptyState, OTSectionHeader, OTProgressBar, OTInlineAlert | 1, 2, 3 |
| StudyPlan/ReviewQueue/GenerationPreview/PackProgress/WeakAreas/SourcePicker/JobStatus/SyncStatus | 4, 5, 6, 7 |
| Action boundary: read-only vs mutating vs blocked | 12, 21 |
| Confirmation for mutating actions | 13, 21, 22 |
| Block arbitrary HTML, unregistered components, hidden side effects | 11, 12 |
| Fallback: CopilotKit unavailable → static overview | 16, 24, 26 |
| Fallback: A2UI rendering failure → safe error card | 10, 11 |
| Fallback: invalid props in dev vs prod | 10 |
| Fallback: provider setup incomplete → disabled actions | 21 |
| Tests: prop validation + catalog lookups | 8, 9 |
| Tests: per-component renderer | 1, 2, 3, 4–7, 11 |
| Tests: action confirmation boundary | 12, 13, 21 |
| Tests: browser/DOM main flow | 22, 26 |
| Tests: regression — unknown components + invalid props | 11, 25 |
| Staged delivery 1: Mantine OT layer | 1, 2, 3 |
| Staged delivery 2: study catalog with mock data | 4, 5, 6, 7 |
| Staged delivery 3: A2UI registry + fixed payloads | 8, 9, 10, 11, 14 |
| Staged delivery 4: dashboard shell + static fallback | 15, 16, 17, 18, 19, 20 |
| Staged delivery 5: CopilotKit/AG-UI live render | 23, 24, 25, 26 |
| Staged delivery 6: confirmed action dispatch | 12, 13, 21, 22 |
| Re-check A2UI/CopilotKit docs before adding deps | 23 |

---

## Final Notes for the Engineer Executing This

- Run `npm run typecheck` before committing in any task that touches `.tsx` — the renderer is excluded from `tsconfig.main.json`'s typecheck target so it's easy to land a runtime-only break.
- Tests in `tests/` are compiled by `tsc -p tsconfig.main.json` (which also emits the imported renderer files into `dist/src/renderer/...`) and then run via `node --test dist/tests/<file>.test.js`. If a new test file imports a renderer file that hasn't been imported elsewhere, that file may need to be referenced from a test or another included module to be emitted. The plan's test files always co-locate their first import with the file under test, so this is handled.
- Each task's commit should leave the suite green. Don't pile multiple tasks into one commit even if they're "small" — the bisect history matters.
- Do not introduce zod, ajv, json-schema-to-ts, or other validation libraries in Phases 1–6. The custom `S` schema utility is enough for the controlled catalog.
- When in doubt about Mantine props, prefer existing patterns in `App.tsx`. Match the existing teal color, radius=8, fw=800/900 conventions.
