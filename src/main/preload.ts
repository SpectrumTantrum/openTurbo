import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, ChatInput, GenerationInput, ImportTextInput, ReviewInput } from "../shared/types.js";

const api = {
  snapshot: () => ipcRenderer.invoke("openturbo:snapshot"),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke("openturbo:settings:update", patch),
  importText: (input: ImportTextInput) => ipcRenderer.invoke("openturbo:source:importText", input),
  generate: (input: GenerationInput) => ipcRenderer.invoke("openturbo:generate", input),
  chat: (input: ChatInput) => ipcRenderer.invoke("openturbo:chat", input),
  review: (input: ReviewInput) => ipcRenderer.invoke("openturbo:review", input),
  exportPack: (packId: string, format: "markdown" | "json" | "anki-csv") => ipcRenderer.invoke("openturbo:export", packId, format),
  providerHealth: () => ipcRenderer.invoke("openturbo:providers:health"),
  testProvider: (providerId: string) => ipcRenderer.invoke("openturbo:providers:test", providerId)
};

contextBridge.exposeInMainWorld("openTurbo", api);

export type OpenTurboApi = typeof api;
