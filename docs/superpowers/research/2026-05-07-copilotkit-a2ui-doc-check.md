# CopilotKit + A2UI Doc Check (2026-05-07)

## Sources Checked

| URL or library id | Status | Date checked |
|---|---|---|
| https://github.com/google/A2UI | 200 — live, public preview v0.8 | 2026-05-07 |
| https://a2ui.org/ | 200 — live, v0.8 stable / v0.9 draft | 2026-05-07 |
| https://a2ui.org/guides/a2ui-with-any-agent-framework/ | 200 — live, full BYOC examples | 2026-05-07 |
| https://a2ui.org/specification/v0.8-a2ui/ | 200 — live, full spec retrieved | 2026-05-07 |
| https://a2ui.org/reference/components/ | 200 — live, 15 built-in components listed | 2026-05-07 |
| https://a2ui.org/guides/authoring-components/ | 500 — doc site macro rendering error (Jinja2 undefined 'resolvedTitle') | 2026-05-07 |
| https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui | 200 — live, CopilotKit runtime A2UI setup | 2026-05-07 |
| https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/dynamic-schema | 200 — live, full dynamic schema flow | 2026-05-07 |
| https://docs.showcase.copilotkit.ai/langgraph-typescript/generative-ui/a2ui/fixed-schema | 200 — live, fixed schema flow with renderA2uiOperations | 2026-05-07 |
| Context7 library `/copilotkit/copilotkit` | Found — High reputation, 7179 snippets | 2026-05-07 |
| Context7 library `/copilotkit/generative-ui` | Found — High reputation, 26 snippets | 2026-05-07 |
| npm `@copilotkit/react-core` | 200 — v1.57.1 published | 2026-05-07 |
| npm `@copilotkit/runtime` | 200 — v1.57.1 published | 2026-05-07 |
| npm `@copilotkit/react-ui` | 200 — v1.57.1 published (being superseded by /v2 path) | 2026-05-07 |
| npm `@copilotkit/a2ui-renderer` | 200 — v1.57.1 published | 2026-05-07 |
| npm `@a2ui/web_core` | 200 — v0.9.2 published | 2026-05-07 |
| npm `@google/a2ui` | 404 — package does not exist | 2026-05-07 |
| npm `@ag-ui/client` | 200 — v0.0.53 published | 2026-05-07 |

---

## Current Package Names + Versions

- **CopilotKit React runtime (v1 / legacy path):** `@copilotkit/react-core` v1.57.1
- **CopilotKit React runtime (v2 / current path):** import from `@copilotkit/react-core/v2` — same npm package, subpath export
- **CopilotKit React UI (legacy):** `@copilotkit/react-ui` v1.57.1 — being consolidated; styles now live at `@copilotkit/react-core/v2/styles.css`
- **CopilotKit server runtime:** `@copilotkit/runtime` v1.57.1
- **A2UI Renderer for CopilotKit:** `@copilotkit/a2ui-renderer` v1.57.1
- **A2UI core (used by a2ui-renderer internally):** `@a2ui/web_core` v0.9.2 (dependency of a2ui-renderer, not installed directly)
- **AG-UI client:** `@ag-ui/client` v0.0.53 (transport layer; CopilotKit wraps this — likely not needed as a direct dep)
- **`@google/a2ui`:** does NOT exist on npm; no separate Google-namespaced package

Minimum install for OpenTurbo frontend:
```bash
npm install @copilotkit/react-core @copilotkit/a2ui-renderer zod
```

Minimum install for OpenTurbo backend/runtime (if adding a Node server):
```bash
npm install @copilotkit/runtime
```

---

## Provider / Hook API (Current)

### V2 API (current — use this)

The v2 API consolidates `@copilotkit/react-ui` into `@copilotkit/react-core/v2`:

```tsx
import { CopilotKitProvider, CopilotPopup } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { myCatalog } from "@/lib/a2ui/catalog";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" a2ui={{ catalog: myCatalog }}>
      {children}
      <CopilotPopup />
    </CopilotKitProvider>
  );
}
```

Key props on `CopilotKitProvider`:
- `runtimeUrl` — URL of the CopilotKit backend runtime endpoint
- `a2ui` — object with `catalog` (custom component catalog) and optional `theme`
- `agent` — optional, names a specific agent to target

### V1 API (legacy — still works in v1.57.1 but being deprecated)

```tsx
import { CopilotKit } from "@copilotkit/react-core";          // note: CopilotKit, not CopilotKitProvider
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
```

**Breaking change:** The provider component was renamed from `CopilotKit` to `CopilotKitProvider` in v2, and the import path consolidates to `/v2`.

---

## Catalog Registration Pattern (Current)

The "bring-your-own-catalog" (BYOC) pattern uses three files exactly as the spec anticipates. The API is stable and published:

### 1. `definitions.ts` — Zod schemas visible to the agent

```typescript
import { z } from "zod";
import type { CatalogDefinitions } from "@copilotkit/a2ui-renderer";

export const myDefinitions = {
  StatusBadge: {
    description: "A small coloured pill communicating the state of something.",
    props: z.object({
      text: z.string(),
      variant: z.enum(["success", "warning", "error", "info"]).optional(),
    }),
  },
  StudyCard: {
    description: "A card summarising a study pack with title and progress.",
    props: z.object({
      title: z.string(),
      progress: z.number().min(0).max(100).optional(),
    }),
  },
} satisfies CatalogDefinitions;

export type MyDefinitions = typeof myDefinitions;
```

### 2. `renderers.tsx` — React components keyed by definition names

```tsx
import type { CatalogRenderers } from "@copilotkit/a2ui-renderer";
import type { MyDefinitions } from "./definitions";

export const myRenderers: CatalogRenderers<MyDefinitions> = {
  StatusBadge: ({ props }) => (
    <span data-variant={props.variant ?? "info"}>{props.text}</span>
  ),
  StudyCard: ({ props, children }) => (
    <div>
      <h3>{props.title}</h3>
      {props.progress !== undefined && <progress value={props.progress} max={100} />}
    </div>
  ),
};
```

### 3. `catalog.ts` — combines definitions + renderers

```typescript
import { createCatalog } from "@copilotkit/a2ui-renderer";
import { myDefinitions } from "./definitions";
import { myRenderers } from "./renderers";

export const myCatalog = createCatalog(myDefinitions, myRenderers, {
  catalogId: "openturbo-catalog",
  includeBasicCatalog: true,   // keeps the 15 built-in A2UI components too
});
```

`CatalogRenderers<T>` is a generic type that enforces type-safe prop alignment with the Zod schemas at compile time.

---

## A2UI Message Shape (Current)

The agent emits JSONL over the AG-UI transport. Three message envelopes constitute one surface render:

### 1. `surfaceUpdate` — declares the component tree (flat adjacency list)

```json
{"surfaceUpdate": {
  "surfaceId": "dashboard-surface",
  "components": [
    {
      "id": "root-col",
      "column": {
        "children": {"explicitList": ["badge-1", "card-1"]}
      }
    },
    {
      "id": "badge-1",
      "StatusBadge": {
        "props": {
          "text": {"literalString": "Due Today: 12"},
          "variant": {"literalString": "warning"}
        }
      }
    },
    {
      "id": "card-1",
      "StudyCard": {
        "props": {
          "title": {"literalString": "Spanish Vocab"},
          "progress": {"path": "/packs/spanish/progress"}
        }
      }
    }
  ]
}}
```

### 2. `dataModelUpdate` — provides state data (separately from structure)

```json
{"dataModelUpdate": {
  "surfaceId": "dashboard-surface",
  "path": "/",
  "contents": [
    {"key": "packs", "valueMap": [
      {"key": "spanish", "valueMap": [
        {"key": "progress", "valueNumber": 62}
      ]}
    ]}
  ]
}}
```

### 3. `beginRendering` — triggers the render pass

```json
{"beginRendering": {
  "surfaceId": "dashboard-surface",
  "root": "root-col",
  "catalogId": "openturbo-catalog"
}}
```

**Comparison with spec's assumed shape `{ component, props, actions }`:**

The spec's compact shape is a higher-level abstraction that does not match the wire format. A2UI uses:
- Component tree via the adjacency-list model in `surfaceUpdate` (not a flat `{ component, props }` object)
- State via a separate `dataModelUpdate` envelope with path-based bindings
- Actions declared inline on component props as `"action": { "name": "...", "context": [...] }`

The mapping is: `component` → `surfaceUpdate.components[].{ComponentName}`, `props` → the inner props object with `BoundValue` bindings, `actions` → inline `action` object per-component.

---

## Action / Tool Invocation (Current)

### How the agent calls client-side handlers

In the **fixed-schema** flow, the backend agent uses helper functions:

```typescript
import { renderA2uiOperations, createSurfaceOp, updateComponentsOp, updateDataModelOp } from "@copilotkit/runtime";

return renderA2uiOperations([
  createSurfaceOp(SURFACE_ID, CATALOG_ID),
  updateComponentsOp(SURFACE_ID, FLIGHT_SCHEMA),
  updateDataModelOp(SURFACE_ID, { origin: "JFK", destination: "LAX", price: 249 }),
]);
```

In the **dynamic-schema** flow, the agent streams A2UI JSONL via `TOOL_CALL_ARGS` events over LangGraph. CopilotKit middleware handles progressive rendering.

### How the client sends actions back to the agent

Components declare an `action` inline in the `surfaceUpdate`. When the user activates the component (e.g., clicks a button), the client sends a `userAction` message:

```json
{"userAction": {
  "name": "generate_notes",
  "surfaceId": "dashboard-surface",
  "sourceComponentId": "generate-btn",
  "timestamp": "2026-05-07T10:00:00Z",
  "context": {
    "packId": "spanish-vocab",
    "outputType": "flashcards"
  }
}}
```

The `context` values are resolved from the data model at click time (path bindings evaluated client-side before sending).

### Comparison with spec's `actions: { name: { actionId } }` registration

The spec sketched a registry of named actions with `actionId` references. The actual protocol is **simpler**: actions are not pre-registered in a separate actions registry. They are declared inline on each component in the `surfaceUpdate`, and the client reports them back via `userAction.name`. There is no separate `actionId` indirection layer.

For the confirmation flow (spec's requirement for mutating actions), A2UI v0.8 does **not** have a built-in confirmation protocol. Confirmation must be implemented at the OpenTurbo application layer — either by:
1. Intercepting `userAction` events before forwarding to the agent and displaying a confirmation dialog, or
2. Designing the agent to emit a confirmation component first, wait for a `userAction` confirm, then proceed.

This matches what the spec says ("Mutating actions require explicit confirmation") but the mechanism is OpenTurbo's responsibility, not the A2UI protocol's.

---

## Divergence from Spec

1. **Provider component name changed in v2:** The spec implies `CopilotKit` (v1 name) but the current v2 API uses `CopilotKitProvider` imported from `@copilotkit/react-core/v2`. Not breaking for intent, but the exact import path in Task 25 code must use the v2 path.

2. **`@copilotkit/react-ui` is being merged into `@copilotkit/react-core/v2`:** The spec lists `@copilotkit/react-ui` as a potential dep. At v1.57.1, both still work, but v2 migration consolidates everything to `@copilotkit/react-core/v2`. New code should not add `@copilotkit/react-ui` as a separate dep.

3. **A2UI message shape is not `{ component, props, actions }`:** The wire protocol uses three separate JSONL envelopes (`surfaceUpdate`, `dataModelUpdate`, `beginRendering`) with an adjacency-list component model and inline `action` objects — not the compact single-object shape the spec used as a mental shorthand. The abstraction holds but the internal types differ.

4. **No separate `@google/a2ui` npm package:** The spec references `A2UI` as a Google project, which might imply `@google/a2ui`. No such package exists. The npm package is `@a2ui/web_core` (used internally by `@copilotkit/a2ui-renderer`), and there is no need to install it directly.

5. **`actions: { name: { actionId } }` registration pattern does not exist:** The spec assumed a separate action-registry mapping. The actual API places actions inline per component in `surfaceUpdate` and the identifier is simply `userAction.name`. OpenTurbo's own action-routing logic (e.g., intercepting `userAction` to trigger IPC calls) must be implemented above the A2UI layer.

6. **Confirmation flow is not in the A2UI v0.8 protocol:** The spec's requirement for confirmation on mutating actions is an OpenTurbo application concern — A2UI provides no built-in confirmation envelope. (v0.9 draft adds `client-side functions` but this is not yet stable.)

7. **`includeBasicCatalog: true` merges 15 built-in components:** The spec's "OpenTurbo catalog" should set `includeBasicCatalog: true` to allow the agent to use the standard A2UI components (Row, Column, Text, Button, etc.) alongside the custom `OT*` and `Study*` components. This is additive, not a conflict.

8. **No material divergence on the BYOC pattern:** The three-file structure (`definitions.ts` / `renderers.tsx` / `catalog.ts`) with `createCatalog`, `CatalogDefinitions`, and `CatalogRenderers` is exactly as described in the spec. This API is live and published.

---

## Recommendation for Phase 7

### Concrete deps to install in Task 24

```bash
# Frontend (Electron renderer / Vite React app)
npm install @copilotkit/react-core @copilotkit/a2ui-renderer zod

# Note: do NOT add @copilotkit/react-ui as a new dep — use /v2 subpath of react-core instead
# Note: do NOT add @a2ui/web_core directly — it is an internal dep of a2ui-renderer
```

If a Node-side CopilotKit runtime endpoint is added:
```bash
npm install @copilotkit/runtime
```

### Concrete imports for `CopilotShell` (Task 25)

```tsx
// Provider
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

// Catalog builder
import { createCatalog, type CatalogDefinitions, type CatalogRenderers } from "@copilotkit/a2ui-renderer";

// Prop schemas
import { z } from "zod";
```

### Spec adjustments needed before Tasks 24/25/26

- The spec's mental shorthand `{ component, props, actions }` should be understood as mapping to the `surfaceUpdate` adjacency list + inline `action` object — no code change needed, just internal documentation clarity.
- The confirmation flow for mutating actions must be implemented as an OpenTurbo interceptor above `userAction` events. Recommend adding a `useA2UIActionGuard` hook in Task 26 that wraps action dispatch and shows a Mantine modal before forwarding to the agent.
- Use `CopilotKitProvider` (not `CopilotKit`) and import from `@copilotkit/react-core/v2` throughout.
- Set `catalogId: "openturbo-catalog"` in `createCatalog` and pass it in `beginRendering` so the agent always selects the approved catalog.

---

## Open Questions for User (if any)

1. **Backend runtime location:** The spec does not specify whether OpenTurbo will run a CopilotKit Node runtime in the Electron main process or connect to an external endpoint. `@copilotkit/runtime` is the server-side dep; the architecture decision affects whether it ships in the app bundle or as an external service. This should be resolved before Task 26 (action dispatch wiring).

2. **AG-UI agent target:** For the LangGraph/Python agent path, CopilotKit supports `injectA2UITool: true` to auto-inject the A2UI tool. If OpenTurbo's agent is Python-based (uses `copilotkit` Python SDK), the `a2ui.create_surface` / `a2ui.render` helper functions from the Python SDK should be verified separately (Python SDK not checked in this doc-check).

3. **v0.9 `createSurface` + client-side functions:** A2UI v0.9 draft (not yet stable) adds first-class client-side function registration and `createSurface`. If this stabilises before implementation, it may simplify the confirmation-flow pattern. Worth re-checking when v0.9 is released.
