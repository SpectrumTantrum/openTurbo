import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuizProgress,
  buildNavMetrics,
  collectDueCards,
  createSettingsPatch,
  filterLibraryItems,
  gradeQuizQuestion,
  nextActionStatus,
  updateProviders,
  type ActionStatusMap
} from "../src/renderer/viewModel.js";
import type { AppSnapshot, Flashcard, ProviderConfig, QuizQuestion, Source, StudyPack } from "../src/shared/types.js";

test("filterLibraryItems filters by query, type, space, and favorite ids", () => {
  const snapshot = sampleSnapshot();

  const byQueryAndSpace = filterLibraryItems(snapshot, {
    query: "biology",
    type: "All",
    selectedSpaceId: "space-bio",
    favoriteIds: []
  });
  assert.deepEqual(
    byQueryAndSpace.sources.map((source: Source) => source.id),
    ["source-bio"]
  );
  assert.deepEqual(
    byQueryAndSpace.packs.map((pack: StudyPack) => pack.id),
    ["pack-bio"]
  );

  const sourceOnly = filterLibraryItems(snapshot, { query: "", type: "Sources", selectedSpaceId: null, favoriteIds: [] });
  assert.deepEqual(sourceOnly.sources.map((source: Source) => source.id), ["source-bio", "source-math"]);
  assert.deepEqual(sourceOnly.packs, []);

  const packOnly = filterLibraryItems(snapshot, { query: "", type: "Packs", selectedSpaceId: null, favoriteIds: [] });
  assert.deepEqual(packOnly.sources, []);
  assert.deepEqual(packOnly.packs.map((pack: StudyPack) => pack.id), ["pack-bio", "pack-math"]);

  const favorites = filterLibraryItems(snapshot, {
    query: "",
    type: "Favorites",
    selectedSpaceId: "space-bio",
    favoriteIds: ["source-math", "pack-bio"]
  });
  assert.deepEqual(favorites.sources, []);
  assert.deepEqual(favorites.packs.map((pack: StudyPack) => pack.id), ["pack-bio"]);
});

test("buildNavMetrics returns sidebar counts, sync text, and provider readiness", () => {
  const metrics = buildNavMetrics(sampleSnapshot());

  assert.equal(metrics.sources.count, 2);
  assert.equal(metrics.sources.label, "2 sources");
  assert.equal(metrics.packs.count, 2);
  assert.equal(metrics.packs.label, "2 study packs");
  assert.equal(metrics.dueCards.count, 3);
  assert.equal(metrics.dueCards.label, "3 cards due");
  assert.deepEqual(metrics.weakAreas.items, ["Respiration", "Linear systems"]);
  assert.equal(metrics.weakAreas.label, "2 weak areas");
  assert.deepEqual(metrics.sync, {
    enabled: true,
    state: "syncing",
    message: "Syncing library",
    label: "Syncing"
  });
  assert.deepEqual(metrics.providers, {
    total: 3,
    enabled: 2,
    ready: 1,
    defaultProviderId: "provider-openai",
    defaultProviderLabel: "OpenAI",
    label: "1 provider ready"
  });
});

test("collectDueCards aggregates due flashcards with source and pack context", () => {
  const due = collectDueCards(sampleSnapshot(), new Date("2026-05-04T12:00:00.000Z"));

  assert.equal(due.length, 3);
  assert.equal(due[0].id, "bio-due");
  assert.equal(due[0].pack.id, "pack-bio");
  assert.equal(due[0].source.id, "source-bio");
  assert.equal(due[0].source.title, "Biology notes");
  assert.equal(due[1].id, "bio-now");
  assert.equal(due[2].id, "math-due");
  assert.equal(due[2].pack.id, "pack-math");
  assert.equal(due[2].source.id, "source-math");
  assert.equal(due[2].source.title, "Algebra worksheet");
});

test("gradeQuizQuestion distinguishes unanswered, correct, and incorrect choices", () => {
  const question = sampleQuizQuestion();

  assert.deepEqual(gradeQuizQuestion(question), {
    isAnswered: false,
    isCorrect: false,
    selectedIndex: undefined
  });
  assert.deepEqual(gradeQuizQuestion(question, 1), {
    isAnswered: true,
    isCorrect: true,
    selectedIndex: 1
  });
  assert.deepEqual(gradeQuizQuestion(question, 2), {
    isAnswered: true,
    isCorrect: false,
    selectedIndex: 2
  });
});

test("buildQuizProgress counts answered and correct quiz choices", () => {
  const questions = [
    sampleQuizQuestion({ id: "q1", answerIndex: 1 }),
    sampleQuizQuestion({ id: "q2", answerIndex: 0 }),
    sampleQuizQuestion({ id: "q3", answerIndex: 2 })
  ];

  assert.deepEqual(buildQuizProgress(questions, { q1: 1, q2: 2 }), {
    answered: 2,
    correct: 1,
    total: 3,
    percent: 67
  });
  assert.deepEqual(buildQuizProgress([], {}), {
    answered: 0,
    correct: 0,
    total: 0,
    percent: 0
  });
});

test("updateProviders toggles fields and keeps exactly one default when requested", () => {
  const providers = sampleProviders();
  const updated = updateProviders(providers, {
    id: "provider-ollama",
    enabled: true,
    isDefault: true,
    chatModel: "llama3.2",
    baseUrl: "http://localhost:11434",
    apiKey: "local-key"
  });

  assert.notEqual(updated, providers);
  assert.notEqual(updated[1], providers[1]);
  assert.equal(providers[1].enabled, false);
  assert.deepEqual(
    updated.map((provider: ProviderConfig) => ({ id: provider.id, enabled: provider.enabled, isDefault: provider.isDefault, model: provider.chatModel })),
    [
      { id: "provider-openai", enabled: true, isDefault: false, model: "gpt-4.1-mini" },
      { id: "provider-ollama", enabled: true, isDefault: true, model: "llama3.2" },
      { id: "provider-empty", enabled: true, isDefault: false, model: undefined }
    ]
  );
  assert.equal(updated[1].baseUrl, "http://localhost:11434");
  assert.equal(updated[1].apiKey, "local-key");
});

test("updateProviders preserves or falls back to one existing default for stale default ids", () => {
  const providers = sampleProviders();
  const preserved = updateProviders(providers, { id: "provider-missing", isDefault: true });

  assert.deepEqual(
    preserved.filter((provider: ProviderConfig) => provider.isDefault).map((provider: ProviderConfig) => provider.id),
    ["provider-openai"]
  );

  const withoutDefault = providers.map((provider) => ({ ...provider, isDefault: false }));
  const fallback = updateProviders(withoutDefault, { id: "provider-missing", isDefault: true });

  assert.deepEqual(
    fallback.filter((provider: ProviderConfig) => provider.isDefault).map((provider: ProviderConfig) => provider.id),
    ["provider-openai"]
  );
});

test("nextActionStatus immutably updates loading, error, and success action states", () => {
  const statuses: ActionStatusMap = {
    import: { loading: true, error: "Old error" },
    sync: { loading: false, success: "Synced" }
  };

  const loading = nextActionStatus(statuses, "import", { loading: true });
  assert.deepEqual(loading.import, { loading: true });
  assert.deepEqual(statuses.import, { loading: true, error: "Old error" });

  const failed = nextActionStatus(loading, "import", { error: "Upload failed" });
  assert.deepEqual(failed.import, { loading: false, error: "Upload failed" });

  const succeeded = nextActionStatus(failed, "import", { success: "Imported" });
  assert.deepEqual(succeeded.import, { loading: false, success: "Imported" });
});

test("createSettingsPatch returns minimal settings patches without untouched fields", () => {
  const providers = sampleProviders();

  assert.deepEqual(createSettingsPatch({ syncServerUrl: "  http://localhost:8787  " }), { syncServerUrl: "http://localhost:8787" });
  assert.deepEqual(createSettingsPatch({ syncServerUrl: "   " }), { syncServerUrl: "" });
  assert.deepEqual(createSettingsPatch({ privacyMode: false }), { privacyMode: false });
  assert.deepEqual(createSettingsPatch({ providers }), { providers });
  assert.deepEqual(createSettingsPatch({ privacyMode: undefined, providers: undefined }), {});
});

function sampleSnapshot(): AppSnapshot {
  return {
    settings: {
      dataPath: "/tmp/openturbo.db",
      fileStoragePath: "/tmp/openturbo-files",
      privacyMode: true,
      outputLanguage: "en",
      syncServerUrl: "http://localhost:8787",
      providers: sampleProviders()
    },
    spaces: [
      { id: "space-bio", name: "Biology", description: "Science", color: "teal", updatedAt: "2026-05-01T00:00:00.000Z", sourceCount: 1, packCount: 1 },
      { id: "space-math", name: "Math", description: "Algebra", color: "blue", updatedAt: "2026-05-02T00:00:00.000Z", sourceCount: 1, packCount: 1 }
    ],
    sources: [
      sampleSource({ id: "source-bio", spaceId: "space-bio", title: "Biology notes", tags: ["cells", "biology"] }),
      sampleSource({ id: "source-math", spaceId: "space-math", title: "Algebra worksheet", kind: "pdf", tags: ["equations"] })
    ],
    packs: [
      samplePack({
        id: "pack-bio",
        sourceId: "source-bio",
        title: "Cell biology pack",
        summary: "Respiration and cells",
        flashcards: [
          sampleCard({ id: "bio-due", packId: "pack-bio", dueAt: "2026-05-03T00:00:00.000Z" }),
          sampleCard({ id: "bio-now", packId: "pack-bio", dueAt: "2026-05-04T12:00:00.000Z" }),
          sampleCard({ id: "bio-future", packId: "pack-bio", dueAt: "2026-05-05T00:00:00.000Z" })
        ]
      }),
      samplePack({
        id: "pack-math",
        sourceId: "source-math",
        title: "Linear algebra drill",
        summary: "Equations and graphing",
        flashcards: [sampleCard({ id: "math-due", packId: "pack-math", dueAt: "2026-05-02T00:00:00.000Z" })]
      })
    ],
    jobs: [],
    chats: [],
    analytics: {
      cardsDue: 3,
      currentStreak: 4,
      weeklyStudyMinutes: 90,
      masteryByTopic: [],
      weakAreas: ["Respiration", "Linear systems"]
    },
    sync: {
      enabled: true,
      serverUrl: "http://localhost:8787",
      lastSyncAt: "2026-05-04T11:45:00.000Z",
      deviceId: "device-1",
      state: "syncing",
      message: "Syncing library"
    }
  };
}

function sampleProviders(): ProviderConfig[] {
  return [
    { id: "provider-openai", kind: "openai", label: "OpenAI", enabled: true, isDefault: true, apiKey: "sk-test", chatModel: "gpt-4.1-mini" },
    { id: "provider-ollama", kind: "ollama", label: "Ollama", enabled: false, isDefault: false, baseUrl: "http://localhost:11434" },
    { id: "provider-empty", kind: "openai-compatible", label: "Needs model", enabled: true, isDefault: false }
  ];
}

function sampleSource(patch: Partial<Source> = {}): Source {
  return {
    id: "source",
    spaceId: "space",
    title: "Source",
    kind: "text",
    text: "Sample text",
    sizeLabel: "1 KB",
    createdAt: "2026-05-01T00:00:00.000Z",
    tags: [],
    ...patch
  };
}

function samplePack(patch: Partial<StudyPack> = {}): StudyPack {
  return {
    id: "pack",
    sourceId: "source",
    title: "Pack",
    summary: "Summary",
    sections: [],
    flashcards: [],
    quiz: [],
    mindMap: { id: "root", label: "Root", children: [] },
    podcastScript: "",
    mastery: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...patch
  };
}

function sampleQuizQuestion(patch: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: "quiz-1",
    prompt: "Which process releases energy from glucose?",
    choices: ["Photosynthesis", "Respiration", "Osmosis"],
    answerIndex: 1,
    explanation: "Respiration breaks down glucose to release energy.",
    citations: [],
    ...patch
  };
}

function sampleCard(patch: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card",
    packId: "pack",
    front: "Front",
    back: "Back",
    dueAt: "2026-05-01T00:00:00.000Z",
    intervalDays: 1,
    ease: 2.5,
    lapses: 0,
    ...patch
  };
}
