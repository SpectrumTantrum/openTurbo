import type { AppSettings, AppSnapshot, Flashcard, ProviderConfig, QuizQuestion, Source, StudyPack, SyncStatus } from "../shared/types.js";

export type LibraryFilter = "All" | "Sources" | "Packs" | "Favorites";

export interface LibraryViewState {
  query: string;
  type: LibraryFilter;
  selectedSpaceId?: string | null;
  favoriteIds: readonly string[];
}

export interface LibraryViewModel {
  sources: Source[];
  packs: StudyPack[];
  sourceCount: number;
  packCount: number;
}

export interface CountMetric {
  count: number;
  label: string;
}

export interface NavMetrics {
  sources: CountMetric;
  packs: CountMetric;
  dueCards: CountMetric;
  weakAreas: CountMetric & { items: string[] };
  sync: Pick<SyncStatus, "enabled" | "state" | "message"> & { label: string };
  providers: {
    total: number;
    enabled: number;
    ready: number;
    defaultProviderId?: string;
    defaultProviderLabel?: string;
    label: string;
  };
}

export type DueCardView = Flashcard & {
  card: Flashcard;
  pack: StudyPack;
  source: Source;
};

export type QuizAnswerMap = Record<string, number>;

export interface QuizQuestionResult {
  isAnswered: boolean;
  isCorrect: boolean;
  selectedIndex?: number;
}

export interface QuizProgress {
  answered: number;
  correct: number;
  total: number;
  percent: number;
}

export interface ProviderUpdatePatch {
  id: string;
  enabled?: boolean;
  isDefault?: boolean;
  model?: string;
  chatModel?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ActionStatus {
  loading: boolean;
  error?: string;
  success?: string;
}

export type ActionStatusMap = Record<string, ActionStatus>;

export interface ActionStatusPatch {
  loading?: boolean;
  error?: string | null;
  success?: string | null;
}

export interface SettingsPatchInput {
  syncServerUrl?: string;
  privacyMode?: boolean;
  providers?: ProviderConfig[];
}

export function filterLibraryItems(snapshot: AppSnapshot, state: LibraryViewState): LibraryViewModel {
  const query = normalize(state.query);
  const favoriteIds = new Set(state.favoriteIds);
  const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
  const selectedSourceIds = new Set(snapshot.sources.filter((source) => isInSelectedSpace(source, state.selectedSpaceId)).map((source) => source.id));

  const sources = snapshot.sources.filter((source) => {
    if (state.type === "Packs") {
      return false;
    }
    if (!isInSelectedSpace(source, state.selectedSpaceId)) {
      return false;
    }
    if (state.type === "Favorites" && !favoriteIds.has(source.id)) {
      return false;
    }
    return matchesSource(source, query);
  });

  const packs = snapshot.packs.filter((pack) => {
    if (state.type === "Sources") {
      return false;
    }
    const source = sourceById.get(pack.sourceId);
    if (state.selectedSpaceId && !selectedSourceIds.has(pack.sourceId)) {
      return false;
    }
    if (state.type === "Favorites" && !favoriteIds.has(pack.id)) {
      return false;
    }
    return matchesPack(pack, source, query);
  });

  return {
    sources,
    packs,
    sourceCount: sources.length,
    packCount: packs.length
  };
}

export function buildNavMetrics(snapshot: AppSnapshot): NavMetrics {
  const enabledProviders = snapshot.settings.providers.filter((provider) => provider.enabled);
  const readyProviders = enabledProviders.filter(isProviderReady);
  const defaultProvider = snapshot.settings.providers.find((provider) => provider.isDefault);

  return {
    sources: countMetric(snapshot.sources.length, "source", "sources"),
    packs: countMetric(snapshot.packs.length, "study pack", "study packs"),
    dueCards: countMetric(snapshot.analytics.cardsDue, "card due", "cards due"),
    weakAreas: {
      ...countMetric(snapshot.analytics.weakAreas.length, "weak area", "weak areas"),
      items: [...snapshot.analytics.weakAreas]
    },
    sync: {
      enabled: snapshot.sync.enabled,
      state: snapshot.sync.state,
      message: snapshot.sync.message,
      label: titleCase(snapshot.sync.state)
    },
    providers: {
      total: snapshot.settings.providers.length,
      enabled: enabledProviders.length,
      ready: readyProviders.length,
      defaultProviderId: defaultProvider?.id,
      defaultProviderLabel: defaultProvider?.label,
      label: countLabel(readyProviders.length, "provider ready", "providers ready")
    }
  };
}

export function collectDueCards(snapshot: AppSnapshot, now: Date): DueCardView[] {
  const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
  const nowMs = now.getTime();
  const dueCards: DueCardView[] = [];

  for (const pack of snapshot.packs) {
    const source = sourceById.get(pack.sourceId);
    if (!source) {
      continue;
    }
    for (const card of pack.flashcards) {
      if (new Date(card.dueAt).getTime() <= nowMs) {
        dueCards.push({ ...card, card, pack, source });
      }
    }
  }

  return dueCards;
}

export function gradeQuizQuestion(question: QuizQuestion, selectedIndex?: number): QuizQuestionResult {
  if (selectedIndex === undefined) {
    return {
      isAnswered: false,
      isCorrect: false,
      selectedIndex: undefined
    };
  }

  return {
    isAnswered: true,
    isCorrect: selectedIndex === question.answerIndex,
    selectedIndex
  };
}

export function buildQuizProgress(questions: readonly QuizQuestion[], answers: QuizAnswerMap): QuizProgress {
  let answered = 0;
  let correct = 0;

  for (const question of questions) {
    const result = gradeQuizQuestion(question, answers[question.id]);
    if (!result.isAnswered) {
      continue;
    }
    answered += 1;
    if (result.isCorrect) {
      correct += 1;
    }
  }

  return {
    answered,
    correct,
    total: questions.length,
    percent: questions.length === 0 ? 0 : Math.round((answered / questions.length) * 100)
  };
}

export function updateProviders(providers: readonly ProviderConfig[], patch: ProviderUpdatePatch): ProviderConfig[] {
  const targetExists = providers.some((provider) => provider.id === patch.id);
  let updated = providers.map((provider) => {
    if (provider.id !== patch.id) {
      return targetExists && patch.isDefault === true ? { ...provider, isDefault: false } : provider;
    }

    const next: ProviderConfig = {
      ...provider,
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
      ...(patch.chatModel !== undefined || patch.model !== undefined ? { chatModel: patch.chatModel ?? patch.model } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
      ...(patch.apiKey !== undefined ? { apiKey: patch.apiKey } : {})
    };
    return next;
  });

  if (patch.isDefault !== undefined) {
    updated = ensureOneDefault(updated, targetExists ? patch.id : undefined);
  }

  return updated;
}

export function nextActionStatus(statuses: ActionStatusMap, key: string, patch: ActionStatusPatch): ActionStatusMap {
  const next: ActionStatus = { ...(statuses[key] ?? { loading: false }) };

  if (patch.loading !== undefined) {
    next.loading = patch.loading;
    if (patch.loading) {
      delete next.error;
      delete next.success;
    }
  }

  if (patch.error !== undefined) {
    next.loading = false;
    delete next.success;
    if (patch.error) {
      next.error = patch.error;
    } else {
      delete next.error;
    }
  }

  if (patch.success !== undefined) {
    next.loading = false;
    delete next.error;
    if (patch.success) {
      next.success = patch.success;
    } else {
      delete next.success;
    }
  }

  return {
    ...statuses,
    [key]: next
  };
}

export function createSettingsPatch(input: SettingsPatchInput): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};

  if (input.syncServerUrl !== undefined) {
    patch.syncServerUrl = input.syncServerUrl.trim();
  }
  if (input.privacyMode !== undefined) {
    patch.privacyMode = input.privacyMode;
  }
  if (input.providers !== undefined) {
    patch.providers = input.providers;
  }

  return patch;
}

function isInSelectedSpace(source: Source, selectedSpaceId?: string | null): boolean {
  return !selectedSpaceId || source.spaceId === selectedSpaceId;
}

function matchesSource(source: Source, query: string): boolean {
  if (!query) {
    return true;
  }
  return searchableText([source.title, source.kind, source.sizeLabel, ...source.tags]).includes(query);
}

function matchesPack(pack: StudyPack, source: Source | undefined, query: string): boolean {
  if (!query) {
    return true;
  }
  return searchableText([pack.title, pack.summary, source?.title, source?.kind, ...(source?.tags ?? [])]).includes(query);
}

function searchableText(values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function countMetric(count: number, singular: string, plural: string): CountMetric {
  return {
    count,
    label: countLabel(count, singular, plural)
  };
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function isProviderReady(provider: ProviderConfig): boolean {
  if (!provider.enabled) {
    return false;
  }
  if (provider.kind === "mock") {
    return true;
  }
  if (provider.kind === "ollama" || provider.kind === "lmstudio") {
    return Boolean(provider.baseUrl && modelFor(provider));
  }
  if (provider.kind === "openai-compatible") {
    return Boolean(provider.baseUrl && provider.apiKey && modelFor(provider));
  }
  return Boolean(provider.apiKey && modelFor(provider));
}

function modelFor(provider: ProviderConfig): string | undefined {
  return provider.chatModel ?? provider.embeddingModel ?? provider.transcriptionModel ?? provider.ttsModel;
}

function ensureOneDefault(providers: ProviderConfig[], preferredId?: string): ProviderConfig[] {
  const preferredProvider = preferredId ? providers.find((provider) => provider.id === preferredId && provider.isDefault) : undefined;
  const defaultId = preferredProvider?.id ?? providers.find((provider) => provider.isDefault)?.id ?? providers[0]?.id;
  let hasDefault = false;

  return providers.map((provider) => {
    const isDefault = !hasDefault && provider.id === defaultId;
    hasDefault = hasDefault || isDefault;
    return provider.isDefault === isDefault ? provider : { ...provider, isDefault };
  });
}
