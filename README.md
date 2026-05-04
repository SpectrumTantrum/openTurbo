# OpenTurbo

OpenTurbo is an AGPL-3.0 local-first desktop study workspace for people who want TurboLearn-style AI study tools without a required hosted service. It is built as an Electron + React + TypeScript app with local persistence, pluggable AI providers, and an optional self-hosted sync service.

## What It Does

- Imports study sources from pasted text today, with service boundaries for PDF, DOCX, OCR, audio/video, live recording, and YouTube transcript workers.
- Generates editable notes, summaries, flashcards, quizzes, mind maps, study plans, and podcast scripts.
- Chats over local sources with citations and actions to turn answers into study material.
- Tracks flashcard review, spaced repetition, mastery, streaks, and weak areas.
- Exports Markdown, JSON backups, and Anki-compatible CSV.
- Connects to local runtimes such as Ollama, LM Studio, and OpenAI-compatible servers, plus BYOK cloud providers.
- Runs offline by default, with an optional Docker sync server for future shared spaces and cross-device sync.

## Development

```bash
npm install
npm run dev
```

In another terminal, run the Electron shell after the main process has been built:

```bash
npm run dev:electron
```

For browser-only UI preview, `npm run dev` is enough. The renderer falls back to an in-memory preview client when Electron IPC is unavailable.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Optional Sync Server

The desktop app works without the sync server. To run the companion service:

```bash
docker compose up sync-server
```

Then add `http://localhost:8787` in OpenTurbo settings.

## License

OpenTurbo is licensed under AGPL-3.0-only. See [LICENSE](./LICENSE).
