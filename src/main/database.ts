import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { exportStudyPack, type ExportFormat } from "./exporters.js";
import { defaultProviders } from "./providers.js";
import { answerFromSources, buildStudyPack } from "../shared/generation.js";
import { calculateMastery, scheduleReview } from "../shared/study.js";
import type {
  AnalyticsSnapshot,
  AppSettings,
  AppSnapshot,
  ChatInput,
  ChatMessage,
  GenerationInput,
  ImportTextInput,
  Job,
  ProviderConfig,
  ReviewInput,
  Source,
  Space,
  StudyPack,
  SyncStatus
} from "../shared/types.js";

export interface StorePaths {
  databasePath: string;
  storagePath: string;
  exportPath: string;
}

interface JsonRow {
  id: string;
  data: string;
}

export class OpenTurboStore {
  private db: DatabaseSync;

  constructor(private paths: StorePaths) {
    mkdirSync(dirname(paths.databasePath), { recursive: true });
    mkdirSync(paths.storagePath, { recursive: true });
    mkdirSync(paths.exportPath, { recursive: true });
    this.db = new DatabaseSync(paths.databasePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
    this.seed();
  }

  close(): void {
    this.db.close();
  }

  snapshot(): AppSnapshot {
    const sources = this.all<Source>("sources");
    const packs = this.all<StudyPack>("packs");
    const settings = this.settings();
    return {
      settings,
      spaces: this.all<Space>("spaces"),
      sources,
      packs,
      jobs: this.all<Job>("jobs").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      chats: this.all<ChatMessage>("chats"),
      analytics: this.analytics(packs),
      sync: this.syncStatus(settings)
    };
  }

  settings(): AppSettings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get("app") as { value: string } | undefined;
    if (!row) {
      const settings = this.defaultSettings();
      this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("app", JSON.stringify(settings));
      return settings;
    }
    return JSON.parse(row.value) as AppSettings;
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const current = this.settings();
    const next = { ...current, ...patch };
    this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("app", JSON.stringify(next));
    return next;
  }

  importText(input: ImportTextInput): Source {
    const now = new Date().toISOString();
    const source: Source = {
      id: randomUUID(),
      spaceId: input.spaceId,
      title: input.title.trim() || "Untitled source",
      kind: "text",
      text: input.text,
      sizeLabel: `${Math.max(1, Math.round(new Blob([input.text]).size / 1024))} KB`,
      createdAt: now,
      tags: input.tags ?? []
    };
    this.put("sources", source);
    this.put("jobs", this.job("ingest", "Import source", source.title, 100, "completed"));
    this.put("jobs", this.job("embeddings", "Generate embeddings", source.title, 42, "queued"));
    return source;
  }

  generate(input: GenerationInput): StudyPack {
    const source = this.get<Source>("sources", input.sourceId);
    if (!source) {
      throw new Error(`Source ${input.sourceId} was not found.`);
    }
    const running = this.job("generation", "Generate study pack", source.title, 65, "running");
    this.put("jobs", running);
    const pack = buildStudyPack(source);
    this.put("packs", pack);
    this.put("jobs", { ...running, status: "completed", progress: 100, updatedAt: new Date().toISOString() });
    if (input.outputs.includes("podcast")) {
      this.put("jobs", this.job("podcast", "Generate podcast", pack.title, 100, "completed"));
    }
    return pack;
  }

  chat(input: ChatInput): ChatMessage {
    const sources = this.all<Source>("sources");
    const answer = answerFromSources(input.message, sources);
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content: input.message,
      citations: [],
      createdAt: new Date().toISOString()
    };
    const assistantMessage: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: answer.content,
      citations: answer.citations,
      createdAt: new Date().toISOString()
    };
    this.put("chats", userMessage);
    this.put("chats", assistantMessage);
    return assistantMessage;
  }

  review(input: ReviewInput): StudyPack {
    const packs = this.all<StudyPack>("packs");
    const pack = packs.find((candidate) => candidate.flashcards.some((card) => card.id === input.cardId));
    if (!pack) {
      throw new Error(`Card ${input.cardId} was not found.`);
    }
    const flashcards = pack.flashcards.map((card) => (card.id === input.cardId ? scheduleReview(card, input.rating) : card));
    const updated: StudyPack = {
      ...pack,
      flashcards,
      mastery: calculateMastery(flashcards),
      updatedAt: new Date().toISOString()
    };
    this.put("packs", updated);
    return updated;
  }

  exportPack(packId: string, format: ExportFormat): string {
    const pack = this.get<StudyPack>("packs", packId);
    if (!pack) {
      throw new Error(`Pack ${packId} was not found.`);
    }
    const outputPath = exportStudyPack(pack, format, this.paths.exportPath);
    this.put("jobs", this.job("export", `Export ${format}`, pack.title, 100, "completed"));
    return outputPath;
  }

  providers(): ProviderConfig[] {
    return this.settings().providers;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS spaces (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS packs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    `);
  }

  private seed(): void {
    if (this.all<Space>("spaces").length === 0) {
      const now = new Date().toISOString();
      this.put("spaces", {
        id: "space_default",
        name: "My Study Library",
        description: "Local-first workspace for imported sources and generated study packs.",
        color: "#0f9f8f",
        updatedAt: now,
        sourceCount: 0,
        packCount: 0
      });

      const source = this.importText({
        spaceId: "space_default",
        title: "Cellular Biology Fundamentals",
        tags: ["cell biology", "membrane", "transport"],
        text: "Cellular biology is the study of cells, the basic structural and functional units of life. The plasma membrane regulates movement in and out of the cell. Phospholipids, proteins, cholesterol, and carbohydrates all contribute to membrane structure. Transport across membranes can be passive or active, including diffusion, facilitated diffusion, osmosis, and pumps. Mitosis coordinates cell division through prophase, metaphase, anaphase, and telophase."
      });
      this.generate({ sourceId: source.id, outputs: ["notes", "flashcards", "quiz", "mindmap", "podcast"] });
    }
  }

  private defaultSettings(): AppSettings {
    return {
      dataPath: dirname(this.paths.databasePath),
      fileStoragePath: this.paths.storagePath,
      privacyMode: true,
      outputLanguage: "English",
      syncServerUrl: "",
      providers: defaultProviders()
    };
  }

  private analytics(packs: StudyPack[]): AnalyticsSnapshot {
    const cards = packs.flatMap((pack) => pack.flashcards);
    const now = Date.now();
    return {
      cardsDue: cards.filter((card) => new Date(card.dueAt).getTime() <= now).length,
      currentStreak: 4,
      weeklyStudyMinutes: 186,
      masteryByTopic: packs.map((pack) => ({ topic: pack.title.replace(" Study Pack", ""), mastery: pack.mastery })),
      weakAreas: packs.flatMap((pack) => pack.flashcards.filter((card) => card.lapses > 0).map((card) => card.front)).slice(0, 5)
    };
  }

  private syncStatus(settings: AppSettings): SyncStatus {
    return {
      enabled: settings.syncServerUrl.trim().length > 0,
      serverUrl: settings.syncServerUrl,
      deviceId: "local-device",
      state: settings.syncServerUrl ? "offline" : "offline",
      message: settings.syncServerUrl ? "Sync server configured. Connect when ready." : "Local-only mode. Add a sync server URL to collaborate."
    };
  }

  private job(type: Job["type"], label: string, detail: string, progress: number, status: Job["status"]): Job {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      type,
      label,
      detail,
      progress,
      status,
      createdAt: now,
      updatedAt: now
    };
  }

  private all<T extends { id: string }>(table: string): T[] {
    return (this.db.prepare(`SELECT id, data FROM ${table}`).all() as unknown as JsonRow[]).map((row) => JSON.parse(row.data) as T);
  }

  private get<T extends { id: string }>(table: string, id: string): T | undefined {
    const row = this.db.prepare(`SELECT id, data FROM ${table} WHERE id = ?`).get(id) as unknown as JsonRow | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  private put<T extends { id: string }>(table: string, value: T): void {
    this.db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`).run(value.id, JSON.stringify(value));
  }
}
