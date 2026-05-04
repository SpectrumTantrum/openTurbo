import { answerFromSources, buildStudyPack } from "../../shared/generation.js";
import { calculateMastery, scheduleReview } from "../../shared/study.js";
import type {
  AppSettings,
  AppSnapshot,
  ChatInput,
  ChatMessage,
  GenerationInput,
  ImportTextInput,
  Job,
  ReviewInput,
  Source,
  Space,
  StudyPack
} from "../../shared/types.js";
import { defaultProviders, detectLocalRuntimes } from "../../main/providers.js";

export interface OpenTurboClient {
  snapshot(): Promise<AppSnapshot>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  importText(input: ImportTextInput): Promise<Source>;
  generate(input: GenerationInput): Promise<StudyPack>;
  chat(input: ChatInput): Promise<ChatMessage>;
  review(input: ReviewInput): Promise<StudyPack>;
  exportPack(packId: string, format: "markdown" | "json" | "anki-csv"): Promise<string>;
  providerHealth(): Promise<unknown>;
}

export function createClient(): OpenTurboClient {
  if (window.openTurbo) {
    return window.openTurbo as OpenTurboClient;
  }
  return createBrowserPreviewClient();
}

function createBrowserPreviewClient(): OpenTurboClient {
  const now = new Date().toISOString();
  const spaces: Space[] = [
    {
      id: "space_default",
      name: "My Study Library",
      description: "Local preview workspace",
      color: "#0f9f8f",
      updatedAt: now,
      sourceCount: 1,
      packCount: 1
    }
  ];
  const sources: Source[] = [
    {
      id: "source_biology",
      spaceId: "space_default",
      title: "Cellular Biology Fundamentals",
      kind: "text",
      text: "Cellular biology is the study of cells, the basic structural and functional units of life. The plasma membrane regulates movement in and out of the cell. Phospholipids, proteins, cholesterol, and carbohydrates all contribute to membrane structure. Transport across membranes can be passive or active, including diffusion, facilitated diffusion, osmosis, and pumps. Mitosis coordinates cell division through prophase, metaphase, anaphase, and telophase.",
      sizeLabel: "86 KB",
      createdAt: now,
      tags: ["cell biology", "membrane", "transport"]
    }
  ];
  const packs: StudyPack[] = [buildStudyPack(sources[0])];
  const jobs: Job[] = [
    job("ocr", "OCR Processing", "Campbell Biology (12e).pdf", 72, "running"),
    job("embeddings", "Generate Embeddings", "Molecular Biology of the Cell", 45, "running"),
    job("podcast", "Generate Podcast", packs[0].title, 18, "running"),
    job("sync", "Index Update", "Library", 100, "completed")
  ];
  const chats: ChatMessage[] = [
    {
      id: "chat_seed",
      role: "assistant",
      content: "Ask anything about your local sources. I can cite sources and turn answers into flashcards, quiz questions, or note sections.",
      citations: [],
      createdAt: now
    }
  ];
  let settings: AppSettings = {
    dataPath: "Browser preview",
    fileStoragePath: "Browser preview",
    privacyMode: true,
    outputLanguage: "English",
    syncServerUrl: "",
    providers: defaultProviders()
  };

  const snapshot = (): AppSnapshot => ({
    settings,
    spaces: spaces.map((space) => ({
      ...space,
      sourceCount: sources.filter((source) => source.spaceId === space.id).length,
      packCount: packs.length
    })),
    sources,
    packs,
    jobs,
    chats,
    analytics: {
      cardsDue: packs.flatMap((pack) => pack.flashcards).filter((card) => new Date(card.dueAt).getTime() <= Date.now()).length,
      currentStreak: 4,
      weeklyStudyMinutes: 186,
      masteryByTopic: packs.map((pack) => ({ topic: pack.title.replace(" Study Pack", ""), mastery: pack.mastery })),
      weakAreas: packs.flatMap((pack) => pack.flashcards.filter((card) => card.lapses > 0).map((card) => card.front))
    },
    sync: {
      enabled: Boolean(settings.syncServerUrl),
      serverUrl: settings.syncServerUrl,
      deviceId: "browser-preview",
      state: "offline",
      message: settings.syncServerUrl ? "Preview sync server configured." : "Local-only preview mode."
    }
  });

  return {
    async snapshot() {
      return snapshot();
    },
    async updateSettings(patch) {
      settings = { ...settings, ...patch };
      return settings;
    },
    async importText(input) {
      const source: Source = {
        id: crypto.randomUUID(),
        spaceId: input.spaceId,
        title: input.title,
        kind: "text",
        text: input.text,
        sizeLabel: `${Math.max(1, Math.round(new Blob([input.text]).size / 1024))} KB`,
        createdAt: new Date().toISOString(),
        tags: input.tags ?? []
      };
      sources.unshift(source);
      jobs.unshift(job("ingest", "Import source", source.title, 100, "completed"));
      return source;
    },
    async generate(input) {
      const source = sources.find((candidate) => candidate.id === input.sourceId);
      if (!source) {
        throw new Error("Source was not found.");
      }
      const pack = buildStudyPack(source);
      packs.unshift(pack);
      jobs.unshift(job("generation", "Generate study pack", pack.title, 100, "completed"));
      return pack;
    },
    async chat(input) {
      const answer = answerFromSources(input.message, sources);
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer.content,
        citations: answer.citations,
        createdAt: new Date().toISOString()
      };
      chats.push({ id: crypto.randomUUID(), role: "user", content: input.message, citations: [], createdAt: new Date().toISOString() }, message);
      return message;
    },
    async review(input) {
      const pack = packs.find((candidate) => candidate.flashcards.some((card) => card.id === input.cardId));
      if (!pack) {
        throw new Error("Card was not found.");
      }
      pack.flashcards = pack.flashcards.map((card) => (card.id === input.cardId ? scheduleReview(card, input.rating) : card));
      pack.mastery = calculateMastery(pack.flashcards);
      return pack;
    },
    async exportPack(packId, format) {
      jobs.unshift(job("export", `Export ${format}`, packId, 100, "completed"));
      return `preview://${packId}.${format}`;
    },
    async providerHealth() {
      return detectLocalRuntimes(settings.providers);
    }
  };
}

function job(type: Job["type"], label: string, detail: string, progress: number, status: Job["status"]): Job {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), type, label, detail, progress, status, createdAt: now, updatedAt: now };
}
