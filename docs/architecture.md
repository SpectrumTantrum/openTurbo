# OpenTurbo Architecture

OpenTurbo is split into three layers:

- `src/main`: Electron main process, SQLite persistence, local jobs, provider adapters, exports, and IPC.
- `src/renderer`: React desktop workspace built with Mantine, Recharts, React Flow, and lucide icons.
- `sync-server`: optional Docker-hosted companion API for device registration, encrypted sync envelopes, shared spaces, comments, and presence.

## Local-First Data

The desktop app stores its SQLite database, imported files, generated audio, and exports inside the Electron user-data directory under `OpenTurbo.local`. The renderer never talks directly to the file system; it uses the preload IPC bridge.

## Provider Interface

Providers expose five capabilities:

- `chat`
- `structuredJson`
- `embeddings`
- `transcription`
- `tts`

The first working provider is the offline mock/template provider. Ollama, LM Studio, OpenAI-compatible URLs, and cloud BYOK providers share the same interface so users can mix local and hosted models.

## Workers

Jobs are persisted as local records so ingestion, OCR, transcription, embeddings, generation, export, podcast, and sync tasks have the same lifecycle. The current implementation runs jobs inline for the desktop MVP; the interfaces are prepared for queued background execution.

## Sync

Sync is optional. The desktop app remains useful without a server. When configured, the sync server accepts encrypted envelopes and exposes shared-space primitives. The MVP server intentionally does not need to understand note contents.
