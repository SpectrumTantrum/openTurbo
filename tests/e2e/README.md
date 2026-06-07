# OpenTurbo E2E (Playwright)

End-to-end tests that drive the **real running app**, complementing the
jsdom + Testing Library unit tests in `tests/*.test.tsx`.

## Two projects

| Project    | Surface                                   | Run                          |
|------------|-------------------------------------------|------------------------------|
| `browser`  | Vite preview (`:5173`, in-memory client)  | `npm run test:e2e`           |
| `electron` | Built desktop app via `_electron`         | `npm run build && npm run test:e2e:electron` |

- **Browser** specs live in `tests/e2e/*.spec.ts` and import `./fixtures/app`.
- **Electron** specs live in `tests/e2e/electron/*.spec.ts` and import `../fixtures/electron`.

The browser project reuses a running `npm run dev` server (`reuseExistingServer`),
so keep one dev server up; workers share it. The electron project launches the
built app per test with an isolated `--user-data-dir` (throwaway temp dir), so it
needs a fresh `npm run build` first and never touches your real app data.

## Selectors

There are **no `data-testid`s**. Drive the UI through accessible roles, matching
the existing unit tests (`tests/renderer-app-shell.test.tsx`):

```ts
page.getByRole("button", { name: "Library" })          // sidebar nav (aria-label)
page.getByRole("dialog", { name: "Import source" })    // modals
page.getByRole("tab", { name: "Flashcards" })          // study tabs
page.getByLabel("Paste source text")                   // form fields
page.getByPlaceholder("Search library...")
page.getByText("Sources (1)")
```

Active nav button carries `aria-current="page"`. Quiz choices are `.choice`.

## Finding bugs: objective signals first

The `consoleErrors` auto fixture records every `console.error` + uncaught
`pageerror` and attaches them to the report. **Weight bug-hunting toward
objective, author-independent failures** rather than guessed expected/actual
assertions (which just re-cover the green unit tests and false-positive on wrong
guesses):

1. `expect(consoleErrors).toEqual([])` — uncaught exceptions / error-boundary trips
2. crashes, dead-end navigation, clicks with no effect
3. visual breakage — screenshot ReactFlow / Recharts / Mantine portals & modals

A one-time, non-reproducing failure is **not** a fileable bug.

## Known stubs — do NOT report as bugs

These are intentionally unimplemented; their disabled/placeholder state is by design:

- PDF / DOCX / OCR / audio / video / YouTube **import** (only text import works)
- **TTS audio** preview/export buttons (disabled)
- rich-text **formatting toolbar** in Notes (disabled)
- **sync execution** (UI configures it; there is no sync IPC channel yet)

Mock backends: the browser preview uses an in-memory client and even Electron
runs generation/chat through `MockProvider` fixtures unless a real provider is
configured — so generation/chat *output quality* is out of scope here.
