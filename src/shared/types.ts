export type ProviderKind =
  | "mock"
  | "ollama"
  | "lmstudio"
  | "openai-compatible"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "openrouter";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type SourceKind =
  | "text"
  | "pdf"
  | "docx"
  | "markdown"
  | "image"
  | "audio"
  | "video"
  | "youtube";

export type StudyTab = "notes" | "flashcards" | "quiz" | "mindmap" | "podcast";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  embeddingModel?: string;
  transcriptionModel?: string;
  ttsModel?: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface AppSettings {
  dataPath: string;
  fileStoragePath: string;
  privacyMode: boolean;
  outputLanguage: string;
  syncServerUrl: string;
  providers: ProviderConfig[];
}

export interface Space {
  id: string;
  name: string;
  description: string;
  color: string;
  updatedAt: string;
  sourceCount: number;
  packCount: number;
}

export interface Source {
  id: string;
  spaceId: string;
  title: string;
  kind: SourceKind;
  filePath?: string;
  text: string;
  sizeLabel: string;
  createdAt: string;
  tags: string[];
}

export interface Citation {
  sourceId: string;
  label: string;
  excerpt: string;
}

export interface NoteSection {
  id: string;
  heading: string;
  body: string;
  citations: Citation[];
}

export interface Flashcard {
  id: string;
  packId: string;
  front: string;
  back: string;
  dueAt: string;
  intervalDays: number;
  ease: number;
  lapses: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  citations: Citation[];
}

export interface StudyPack {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  sections: NoteSection[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  mindMap: MindMapNode;
  podcastScript: string;
  podcastAudioPath?: string;
  mastery: number;
  createdAt: string;
  updatedAt: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
}

export interface Job {
  id: string;
  type: "ingest" | "ocr" | "transcription" | "embeddings" | "generation" | "export" | "podcast" | "sync";
  label: string;
  detail: string;
  progress: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface AnalyticsSnapshot {
  cardsDue: number;
  currentStreak: number;
  weeklyStudyMinutes: number;
  masteryByTopic: Array<{ topic: string; mastery: number }>;
  weakAreas: string[];
}

export interface SyncStatus {
  enabled: boolean;
  serverUrl: string;
  lastSyncAt?: string;
  deviceId: string;
  state: "offline" | "connected" | "syncing" | "error";
  message: string;
}

export interface AppSnapshot {
  settings: AppSettings;
  spaces: Space[];
  sources: Source[];
  packs: StudyPack[];
  jobs: Job[];
  chats: ChatMessage[];
  analytics: AnalyticsSnapshot;
  sync: SyncStatus;
}

export interface ImportTextInput {
  title: string;
  text: string;
  spaceId: string;
  tags?: string[];
}

export interface GenerationInput {
  sourceId: string;
  outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">;
}

export interface ChatInput {
  scopeId: string;
  message: string;
}

export interface ReviewInput {
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
}
