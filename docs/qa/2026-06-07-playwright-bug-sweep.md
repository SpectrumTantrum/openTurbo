# Playwright bug sweep — 2026-06-07

Automated QA sweep of OpenTurbo driving the **real running app** with Playwright,
across both surfaces, with adversarial verification before any bug was filed.

- **Commit swept:** `231dd93` (branch `development`)
- **Harness added:** `@playwright/test` + `playwright.config.ts` + `tests/e2e/`
- **Result:** 6 reproducible bugs filed as issues #1–#6 (all `bug` + `needs-triage`)
- **Sweep cost:** 23 agents · ~25 min · 16 feature areas (15 browser + 1 Electron)

## Scope & framing

OpenTurbo is mock-heavy by design: the browser preview uses an in-memory client,
and even in Electron, generation/chat run through `MockProvider` fixtures unless a
real provider is configured. So this sweep finds **UI / interaction / rendering /
navigation / persistence-plumbing bugs observed driving the app over mock
backends** — *not* generation/chat output-quality bugs. The issue list is "bugs
observable driving the UI," not the app's complete bug inventory.

**Out of scope / known stubs (not filed):** PDF/DOCX/OCR/audio/video/YouTube
import, TTS audio preview/export, the Notes rich-text formatting toolbar, and sync
execution — all intentionally unimplemented.

## Method

- Two Playwright projects: `browser` (Vite preview at `:5173`, shared server) and
  `electron` (built app via `_electron`, isolated `--user-data-dir` per test).
- A `consoleErrors` auto-fixture records every `console.error` / uncaught
  `pageerror` — the primary, author-independent bug signal.
- Bug-hunting weighted toward **objective signals** (console errors, crashes,
  dead-end/no-op clicks, visual breakage in ReactFlow/Recharts/Mantine) over
  guessed assertions; visual issues confirmed by reading screenshots.
- Every candidate was **adversarially re-reproduced 2×** by an independent agent
  and ruled out if it didn't reproduce or was an intended stub/expected behavior.

## Confirmed bugs

| # | Sev | Area | Bug | Root cause |
|---|-----|------|-----|-----------|
| [#1](https://github.com/SpectrumTantrum/openTurbo/issues/1) | medium | mindmap | Leaf nodes render stacked on identical coordinates (~5 of 9 hidden) | `mindMapToFlow` leaf-`y` index collision, `src/renderer/App.tsx:~1967` |
| [#2](https://github.com/SpectrumTantrum/openTurbo/issues/2) | medium | dashboard | GenerationPreviewCard chips are a no-op + pop an "Unknown action." error | `onToggleOutput` wired to `actionId:"noop"`, `src/renderer/a2ui/samplePayloads.ts:69` → `UNKNOWN_BLOCKED` |
| [#3](https://github.com/SpectrumTantrum/openTurbo/issues/3) | low | mindmap | Root node clipped below the editor footer at default viewport | `.mindmap` `height:520px` in ~305px scroll, `src/renderer/App.css:446` |
| [#4](https://github.com/SpectrumTantrum/openTurbo/issues/4) | low | chat | Chat doesn't auto-scroll to the newest message after sending | No scroll-to-bottom in AssistantPane, `src/renderer/App.tsx:1667-1715` |
| [#5](https://github.com/SpectrumTantrum/openTurbo/issues/5) | low | jobqueue | Footer chart card renders empty on first launch | Recharts `AreaChart` can't draw from a single data point |
| [#6](https://github.com/SpectrumTantrum/openTurbo/issues/6) | low | jobqueue | Footer job cards clip progress bars at viewport height ≤ 700 | `max-height:700` media query, `src/renderer/App.css:701-709` |

## Areas that came back clean

navigation · source import + generation · notes · flashcards/SM-2 review · review
session · quiz · analytics (data) · spaces/favorites/search · settings/providers ·
and **all Electron-only paths** (export-to-disk, persistence-across-restart,
provider health all worked).

## The committed suite

15 browser spec files + Electron specs under `tests/e2e/`. Current state:
**109 passing, 6 `test.fixme`** (the bugs above, each documented as a skipped
repro test that should be converted to a passing regression when fixed).

```bash
npm run test:e2e            # browser project (needs a running `npm run dev`, or it starts one)
npm run build               # required before the electron pass (refreshes dist-renderer)
npm run test:e2e:electron   # electron project (isolated user-data-dir per test)
npm run test:e2e:report     # open the HTML report
```

Selectors follow the existing accessible-role conventions (no `data-testid`s); see
`tests/e2e/README.md`.
