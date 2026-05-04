import { ipcMain } from "electron";
import type { OpenTurboStore } from "./database.js";
import { createProvider, detectLocalRuntimes } from "./providers.js";
import type { AppSettings, ChatInput, GenerationInput, ImportTextInput, ReviewInput } from "../shared/types.js";

export function registerIpc(store: OpenTurboStore): void {
  ipcMain.handle("openturbo:snapshot", () => store.snapshot());
  ipcMain.handle("openturbo:settings:update", (_event, patch: Partial<AppSettings>) => store.updateSettings(patch));
  ipcMain.handle("openturbo:source:importText", (_event, input: ImportTextInput) => store.importText(input));
  ipcMain.handle("openturbo:generate", (_event, input: GenerationInput) => store.generate(input));
  ipcMain.handle("openturbo:chat", (_event, input: ChatInput) => store.chat(input));
  ipcMain.handle("openturbo:review", (_event, input: ReviewInput) => store.review(input));
  ipcMain.handle("openturbo:export", (_event, packId: string, format: "markdown" | "json" | "anki-csv") => store.exportPack(packId, format));
  ipcMain.handle("openturbo:providers:health", () => detectLocalRuntimes(store.providers()));
  ipcMain.handle("openturbo:providers:test", async (_event, providerId: string) => {
    const provider = store.providers().find((candidate) => candidate.id === providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} was not found.`);
    }
    return createProvider(provider).health();
  });
}
