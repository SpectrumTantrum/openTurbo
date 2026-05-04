import { extname } from "node:path";
import type { SourceKind } from "../shared/types.js";

export interface ImporterCapability {
  kind: SourceKind;
  label: string;
  extensions: string[];
  workerType: "inline" | "ocr" | "transcription" | "transcript-fetch";
  ready: boolean;
}

export const importerCapabilities: ImporterCapability[] = [
  { kind: "text", label: "Plain text", extensions: [".txt"], workerType: "inline", ready: true },
  { kind: "markdown", label: "Markdown", extensions: [".md", ".markdown"], workerType: "inline", ready: true },
  { kind: "pdf", label: "PDF", extensions: [".pdf"], workerType: "ocr", ready: false },
  { kind: "docx", label: "Word document", extensions: [".docx"], workerType: "inline", ready: false },
  { kind: "image", label: "Image OCR", extensions: [".png", ".jpg", ".jpeg", ".webp", ".tiff"], workerType: "ocr", ready: false },
  { kind: "audio", label: "Audio transcription", extensions: [".mp3", ".wav", ".m4a", ".aac", ".flac"], workerType: "transcription", ready: false },
  { kind: "video", label: "Video transcription", extensions: [".mp4", ".mov", ".mkv", ".webm"], workerType: "transcription", ready: false },
  { kind: "youtube", label: "YouTube transcript", extensions: [], workerType: "transcript-fetch", ready: false }
];

export function detectImportKind(pathOrUrl: string): ImporterCapability {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(pathOrUrl)) {
    return importerCapabilities.find((capability) => capability.kind === "youtube")!;
  }

  const extension = extname(pathOrUrl).toLowerCase();
  return importerCapabilities.find((capability) => capability.extensions.includes(extension)) ?? importerCapabilities[0];
}

export function unsupportedImporterMessage(pathOrUrl: string): string | undefined {
  const capability = detectImportKind(pathOrUrl);
  if (capability.ready) {
    return undefined;
  }
  return `${capability.label} import is registered and will run through the ${capability.workerType} worker once a provider is configured.`;
}
