import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  MantineProvider,
  Modal,
  NativeSelect,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip
} from "@mantine/core";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import {
  Activity,
  AudioLines,
  BookOpen,
  Brain,
  Check,
  Download,
  FileText,
  FolderKanban,
  Gauge,
  Library,
  MessageSquareText,
  Mic,
  Network,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  Upload,
  WifiOff,
  Zap
} from "lucide-react";
import { createClient } from "./data/client.js";
import { StudyWorkspace } from "./workspace/StudyWorkspace.js";
import { GenerativeStudyDashboard } from "./dashboard/GenerativeStudyDashboard.js";
import { QuizView } from "./QuizView.js";
import {
  buildNavMetrics,
  collectDueCards,
  filterLibraryItems,
  nextActionStatus,
  type ActionStatus,
  type ActionStatusMap,
  type LibraryFilter
} from "./viewModel.js";
import type { AppSnapshot, ChatMessage, Flashcard, MindMapNode, ProviderConfig, Source, StudyPack, StudyTab } from "../shared/types.js";

const client = createClient();
type ProviderHealthResult = Awaited<ReturnType<typeof client.providerHealth>>;
type ProviderHealthItem = ProviderHealthResult[number];
type ActionResult<T> = { ok: true; value: T } | { ok: false };
type NavLabel = "Dashboard" | "Library" | "Spaces" | "Review" | "Analytics" | "Sync" | "Settings";
type SettingsDraft = Pick<AppSnapshot["settings"], "syncServerUrl" | "privacyMode">;

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [activeNav, setActiveNav] = useState<NavLabel>("Dashboard");
  const [activeTab, setActiveTab] = useState<StudyTab>("notes");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("All");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("Lecture notes");
  const [importText, setImportText] = useState("");
  const [chatText, setChatText] = useState("");
  const [providerHealth, setProviderHealth] = useState<ProviderHealthResult | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, ProviderHealthItem>>({});
  const [actionStatuses, setActionStatuses] = useState<ActionStatusMap>({});
  const [clockNow, setClockNow] = useState(() => new Date());
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({ syncServerUrl: "", privacyMode: true });
  const [settingsDraftReady, setSettingsDraftReady] = useState(false);

  const refresh = async () => {
    const next = await client.snapshot();
    const visibleSources = sourcesForSpace(next, selectedSpaceId);
    const visibleSourceIds = new Set(visibleSources.map((source) => source.id));
    const visiblePacks = next.packs.filter((pack) => visibleSourceIds.has(pack.sourceId));
    setSnapshot(next);
    setSelectedSourceId((current) => current ?? visibleSources[0]?.id ?? null);
    setSelectedPackId((current) => current ?? visiblePacks[0]?.id ?? null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (snapshot && !settingsDraftReady) {
      setSettingsDraft(settingsDraftFromSnapshot(snapshot));
      setSettingsDraftReady(true);
    }
  }, [settingsDraftReady, snapshot]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const visibleSources = snapshot ? sourcesForSpace(snapshot, selectedSpaceId) : [];
  const visibleSourceIds = new Set(visibleSources.map((source) => source.id));
  const visiblePacks = snapshot?.packs.filter((pack) => visibleSourceIds.has(pack.sourceId)) ?? [];
  const selectedSource = visibleSources.find((source) => source.id === selectedSourceId) ?? (selectedSpaceId ? undefined : visibleSources[0]);
  const selectedPack = visiblePacks.find((pack) => pack.id === selectedPackId) ?? visiblePacks.find((pack) => pack.sourceId === selectedSource?.id) ?? (selectedSpaceId ? undefined : visiblePacks[0]);
  const defaultProvider = snapshot?.settings.providers.find((provider) => provider.isDefault) ?? snapshot?.settings.providers[0];
  const libraryItems = useMemo(
    () =>
      snapshot
        ? filterLibraryItems(snapshot, {
            query: libraryQuery,
            type: libraryFilter,
            selectedSpaceId,
            favoriteIds
          })
        : { sources: [], packs: [], sourceCount: 0, packCount: 0 },
    [favoriteIds, libraryFilter, libraryQuery, selectedSpaceId, snapshot]
  );
  const dueCards = useMemo(() => (snapshot ? collectDueCards(snapshot, clockNow) : []), [clockNow, snapshot]);
  const navMetrics = useMemo(() => (snapshot ? buildNavMetrics(snapshot) : null), [snapshot]);
  const isLoading = (key: string) => actionStatuses[key]?.loading ?? false;
  const clearActionStatuses = (keys: string[]) => {
    setActionStatuses((current) =>
      keys.reduce(
        (next, key) => nextActionStatus(nextActionStatus(nextActionStatus(next, key, { loading: false }), key, { error: null }), key, { success: null }),
        current
      )
    );
  };

  async function runAction<T>(key: string, action: () => Promise<T>, success: string): Promise<ActionResult<T>> {
    setActionStatuses((current) => nextActionStatus(current, key, { loading: true }));
    try {
      const value = await action();
      setActionStatuses((current) => nextActionStatus(current, key, { success }));
      return { ok: true, value };
    } catch (error) {
      setActionStatuses((current) => nextActionStatus(current, key, { error: formatError(error) }));
      return { ok: false };
    }
  }

  async function handleImport() {
    if (!snapshot || !importText.trim() || !defaultProvider || isLoading("import") || isLoading("importGenerate")) {
      return;
    }
    const sourceResult = await runAction("import", () => client.importText({
      title: importTitle.trim() || "Untitled source",
      text: importText,
      spaceId: selectedSpaceId ?? snapshot.spaces[0]?.id ?? "space_default",
      tags: importTitle.toLowerCase().split(/\s+/).slice(0, 3)
    }), "Source imported.");
    if (!sourceResult.ok) {
      return;
    }
    const source = sourceResult.value;
    const packResult = await runAction("importGenerate", async () => {
      const generatedPack = await client.generate({ sourceId: source.id, outputs: ["notes", "flashcards", "quiz", "mindmap", "podcast"] });
      setSelectedSourceId(source.id);
      setSelectedPackId(generatedPack.id);
      await refresh();
      return generatedPack;
    }, "Study pack generated.");
    if (!packResult.ok) {
      return;
    }
    setImportText("");
    setImportOpen(false);
  }

  async function handleGenerate(outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) {
    if (!selectedSource || !defaultProvider || isLoading("generate")) {
      return;
    }
    await runAction("generate", async () => {
      const pack = await client.generate({ sourceId: selectedSource.id, outputs });
      setSelectedPackId(pack.id);
      await refresh();
      return pack;
    }, "Study pack generated.");
  }

  async function handleChat() {
    if (!selectedPack || !defaultProvider || !chatText.trim() || isLoading("chat")) {
      return;
    }
    const message = chatText;
    const result = await runAction("chat", async () => {
      const response = await client.chat({ scopeId: selectedPack.id, message });
      await refresh();
      return response;
    }, "Assistant response added.");
    if (result.ok) {
      setChatText("");
    }
  }

  async function handleReview(card: Flashcard, rating: "again" | "hard" | "good" | "easy") {
    const key = `review:${card.id}`;
    if (isLoading(key)) {
      return;
    }
    await runAction(key, async () => {
      const pack = await client.review({ cardId: card.id, rating });
      await refresh();
      return pack;
    }, "Review saved.");
  }

  async function handleExport(format: "markdown" | "json" | "anki-csv") {
    const key = `export:${format}`;
    if (!selectedPack || isLoading(key)) {
      return;
    }
    await runAction(key, async () => {
      const target = await client.exportPack(selectedPack.id, format);
      await refresh();
      return target;
    }, `Exported ${format}.`);
  }

  async function handleProviderHealth() {
    if (isLoading("providerHealth")) {
      return;
    }
    const result = await runAction("providerHealth", () => client.providerHealth(), "Provider health refreshed.");
    if (result.ok) {
      setProviderHealth(result.value);
    }
  }

  async function handleProviderTest(providerId: string) {
    const key = `providerTest:${providerId}`;
    if (!providerId || isLoading(key)) {
      return;
    }
    setActionStatuses((current) => nextActionStatus(current, key, { loading: true }));
    try {
      const health = await client.testProvider(providerId);
      setProviderTestResults((current) => ({ ...current, [providerId]: health }));
      setActionStatuses((current) =>
        nextActionStatus(current, key, health.ok ? { success: "Provider test passed." } : { error: health.message || "Provider test reported an issue." })
      );
    } catch (error) {
      setActionStatuses((current) => nextActionStatus(current, key, { error: formatError(error) }));
    }
  }

  async function handleSettingsSave(draft: SettingsDraft): Promise<boolean> {
    if (isLoading("settingsSave")) {
      return false;
    }
    const result = await runAction("settingsSave", async () => {
      const savedSettings = await client.updateSettings(draft);
      await refresh();
      setSettingsDraft({
        syncServerUrl: savedSettings.syncServerUrl,
        privacyMode: savedSettings.privacyMode
      });
      setSettingsDraftReady(true);
      return true;
    }, "Settings saved.");
    return result.ok;
  }

  function updateSettingsDraft(patch: Partial<SettingsDraft>) {
    setSettingsDraft((current) => ({ ...current, ...patch }));
    setSettingsDraftReady(true);
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => (current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id]));
  }

  function setSelectedSpace(spaceId: string | null) {
    if (!snapshot) {
      setSelectedSpaceId(spaceId);
      setSelectedSourceId(null);
      setSelectedPackId(null);
      return;
    }

    const visibleSources = sourcesForSpace(snapshot, spaceId);
    const visibleSourceIds = new Set(visibleSources.map((source) => source.id));
    const visiblePacks = snapshot.packs.filter((pack) => visibleSourceIds.has(pack.sourceId));
    const currentSource = visibleSources.find((source) => source.id === selectedSourceId) ?? visibleSources[0];
    const currentPack =
      visiblePacks.find((pack) => pack.id === selectedPackId) ??
      visiblePacks.find((pack) => pack.sourceId === currentSource?.id) ??
      visiblePacks[0];

    setSelectedSpaceId(spaceId);
    setSelectedSourceId(currentSource?.id ?? null);
    setSelectedPackId(currentPack?.id ?? null);
  }

  function selectSource(source: Source) {
    setSelectedSourceId(source.id);
    setSelectedSpaceId(source.spaceId);
    const pack = snapshot?.packs.find((candidate) => candidate.sourceId === source.id);
    if (pack) {
      setSelectedPackId(pack.id);
    }
  }

  function selectPack(pack: StudyPack) {
    setSelectedPackId(pack.id);
    setSelectedSourceId(pack.sourceId);
    const source = snapshot?.sources.find((candidate) => candidate.id === pack.sourceId);
    if (source) {
      setSelectedSpaceId(source.spaceId);
    }
  }

  function focusSpace(spaceId: string | null) {
    setSelectedSpace(spaceId);
    setLibraryFilter("All");
    setActiveNav("Library");
  }

  if (!snapshot) {
    return (
      <MantineProvider>
        <div className="loading">Loading OpenTurbo...</div>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={{ primaryColor: "teal", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <div className="desktop-frame">
        <Sidebar active={activeNav} setActive={setActiveNav} snapshot={snapshot} metrics={navMetrics} onSettings={() => setSettingsOpen(true)} />
        <main className="workspace">
          <WorkspaceView
            activeNav={activeNav}
            snapshot={snapshot}
            selectedSource={selectedSource}
            selectedPack={selectedPack}
            selectedSourceId={selectedSource?.id}
            selectedPackId={selectedPack?.id}
            selectedSpaceId={selectedSpaceId}
            libraryItems={libraryItems}
            libraryQuery={libraryQuery}
            libraryFilter={libraryFilter}
            favoriteIds={favoriteIds}
            activeTab={activeTab}
            chatText={chatText}
            provider={defaultProvider}
            providerHealth={providerHealth}
            actionStatuses={actionStatuses}
            settingsDraft={settingsDraft}
            dueCards={dueCards}
            providerTestResults={providerTestResults}
            onSetLibraryQuery={setLibraryQuery}
            onSetLibraryFilter={setLibraryFilter}
            onSetSelectedSpace={setSelectedSpace}
            onToggleFavorite={toggleFavorite}
            onSelectSource={selectSource}
            onSelectPack={selectPack}
            onFocusSpace={focusSpace}
            onSetActiveTab={setActiveTab}
            onSetChatText={setChatText}
            onGenerate={handleGenerate}
            onReview={handleReview}
            onExport={handleExport}
            onChat={handleChat}
            onProviderHealth={handleProviderHealth}
            onSettingsDraftChange={updateSettingsDraft}
            onSaveSettings={handleSettingsSave}
            onOpenSettings={() => setSettingsOpen(true)}
            onTestProvider={handleProviderTest}
            onImport={() => {
              clearActionStatuses(["import", "importGenerate"]);
              setImportOpen(true);
            }}
          />
        </main>
        <JobQueue jobs={snapshot.jobs} analytics={snapshot.analytics} />
      </div>

      <Modal
        opened={importOpen}
        onClose={() => {
          clearActionStatuses(["import", "importGenerate"]);
          setImportOpen(false);
        }}
        title="Import source"
        size="lg"
        radius={8}
        closeButtonProps={{ "aria-label": "Close import source" }}
      >
        <Stack>
          <TextInput label="Title" value={importTitle} onChange={(event) => setImportTitle(event.currentTarget.value)} />
          <Textarea
            label="Paste source text"
            autosize
            minRows={10}
            placeholder="Paste lecture notes, a transcript, article text, or textbook excerpt..."
            value={importText}
            onChange={(event) => setImportText(event.currentTarget.value)}
          />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              PDF, DOCX, OCR, audio, video, and YouTube importers are represented in the service boundary and ready for provider-specific workers.
            </Text>
            <Button leftSection={<Upload size={16} />} onClick={handleImport} loading={isLoading("import") || isLoading("importGenerate")} disabled={!importText.trim() || !defaultProvider || isLoading("import") || isLoading("importGenerate")}>
              Import and generate
            </Button>
          </Group>
          {!defaultProvider && (
            <Text size="sm" c="red">
              Configure a provider before generating a study pack.
            </Text>
          )}
          <ActionFeedback status={actionStatuses.import} loadingMessage="Importing source..." />
          <ActionFeedback status={actionStatuses.importGenerate} loadingMessage="Generating study pack..." />
        </Stack>
      </Modal>

      <SettingsDrawer
        snapshot={snapshot}
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
        onTestProvider={handleProviderTest}
        providerTestResults={providerTestResults}
        actionStatuses={actionStatuses}
        settingsDraft={settingsDraft}
        onSettingsDraftChange={updateSettingsDraft}
      />
    </MantineProvider>
  );
}

function WorkspaceView({
  activeNav,
  snapshot,
  selectedSource,
  selectedPack,
  selectedSourceId,
  selectedPackId,
  selectedSpaceId,
  libraryItems,
  libraryQuery,
  libraryFilter,
  favoriteIds,
  activeTab,
  chatText,
  provider,
  providerHealth,
  actionStatuses,
  settingsDraft,
  dueCards,
  providerTestResults,
  onSetLibraryQuery,
  onSetLibraryFilter,
  onSetSelectedSpace,
  onToggleFavorite,
  onSelectSource,
  onSelectPack,
  onFocusSpace,
  onSetActiveTab,
  onSetChatText,
  onGenerate,
  onReview,
  onExport,
  onChat,
  onProviderHealth,
  onSettingsDraftChange,
  onSaveSettings,
  onOpenSettings,
  onTestProvider,
  onImport
}: {
  activeNav: NavLabel;
  snapshot: AppSnapshot;
  selectedSource?: Source;
  selectedPack?: StudyPack;
  selectedSourceId?: string;
  selectedPackId?: string;
  selectedSpaceId: string | null;
  libraryItems: ReturnType<typeof filterLibraryItems>;
  libraryQuery: string;
  libraryFilter: LibraryFilter;
  favoriteIds: string[];
  activeTab: StudyTab;
  chatText: string;
  provider?: ProviderConfig;
  providerHealth: ProviderHealthResult | null;
  actionStatuses: ActionStatusMap;
  settingsDraft: SettingsDraft;
  dueCards: ReturnType<typeof collectDueCards>;
  providerTestResults: Record<string, ProviderHealthItem>;
  onSetLibraryQuery: (value: string) => void;
  onSetLibraryFilter: (value: LibraryFilter) => void;
  onSetSelectedSpace: (value: string | null) => void;
  onToggleFavorite: (id: string) => void;
  onSelectSource: (source: Source) => void;
  onSelectPack: (pack: StudyPack) => void;
  onFocusSpace: (spaceId: string | null) => void;
  onSetActiveTab: (tab: StudyTab) => void;
  onSetChatText: (value: string) => void;
  onGenerate: (outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) => void | Promise<void>;
  onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void | Promise<void>;
  onExport: (format: "markdown" | "json" | "anki-csv") => void | Promise<void>;
  onChat: () => void | Promise<void>;
  onProviderHealth: () => void | Promise<void>;
  onSettingsDraftChange: (patch: Partial<SettingsDraft>) => void;
  onSaveSettings: (draft: SettingsDraft) => Promise<boolean>;
  onOpenSettings: () => void;
  onTestProvider: (providerId: string) => void | Promise<void>;
  onImport: () => void;
}) {
  if (activeNav === "Dashboard") {
    return (
      <FullWorkspaceSection title="Dashboard" subtitle="Ask the assistant to build your study view.">
        <GenerativeStudyDashboard
          snapshotHints={{
            dueCount: snapshot.analytics.cardsDue,
            weakAreas: snapshot.analytics.weakAreas,
            jobs: snapshot.jobs.map((job) => ({
              id: job.id,
              label: job.label,
              detail: job.detail,
              status: job.status,
              progress: job.progress
            })),
            firstSourceTitle: snapshot.sources[0]?.title
          }}
          onAction={() => undefined}
          agentAvailable
        />
      </FullWorkspaceSection>
    );
  }

  if (activeNav === "Library") {
    return (
      <StudyWorkspace>
        <LibraryPane
          snapshot={snapshot}
          items={libraryItems}
          selectedSourceId={selectedSourceId}
          selectedPackId={selectedPackId}
          selectedSpaceId={selectedSpaceId}
          query={libraryQuery}
          filter={libraryFilter}
          favoriteIds={favoriteIds}
          onSetQuery={onSetLibraryQuery}
          onSetFilter={onSetLibraryFilter}
          onSetSelectedSpace={onSetSelectedSpace}
          onToggleFavorite={onToggleFavorite}
          onSelectSource={onSelectSource}
          onSelectPack={onSelectPack}
          onImport={onImport}
        />
        <EditorPane
          activeTab={activeTab}
          setActiveTab={onSetActiveTab}
          source={selectedSource}
          pack={selectedPack}
          onGenerate={onGenerate}
          onReview={onReview}
          onExport={onExport}
          actionStatuses={actionStatuses}
          hasProvider={Boolean(provider)}
        />
        <AssistantPane
          provider={provider}
          pack={selectedPack}
          chats={snapshot.chats}
          chatText={chatText}
          setChatText={onSetChatText}
          onChat={onChat}
          onGenerate={onGenerate}
          onProviderHealth={onProviderHealth}
          providerHealth={providerHealth}
          actionStatuses={actionStatuses}
        />
      </StudyWorkspace>
    );
  }

  if (activeNav === "Spaces") {
    return <SpacesView snapshot={snapshot} selectedSpaceId={selectedSpaceId} onFocusSpace={onFocusSpace} />;
  }

  if (activeNav === "Review") {
    return <ReviewView dueCards={dueCards} actionStatuses={actionStatuses} onReview={onReview} />;
  }

  if (activeNav === "Analytics") {
    return <AnalyticsView snapshot={snapshot} />;
  }

  if (activeNav === "Sync") {
    return <SyncView snapshot={snapshot} actionStatuses={actionStatuses} settingsDraft={settingsDraft} onSettingsDraftChange={onSettingsDraftChange} onSave={onSaveSettings} />;
  }

  return (
    <SettingsOverview
      snapshot={snapshot}
      providerHealth={providerHealth}
      providerTestResults={providerTestResults}
      actionStatuses={actionStatuses}
      onProviderHealth={onProviderHealth}
      onOpenSettings={onOpenSettings}
      onTestProvider={onTestProvider}
    />
  );
}

function Sidebar({
  active,
  setActive,
  snapshot,
  metrics,
  onSettings
}: {
  active: NavLabel;
  setActive: (value: NavLabel) => void;
  snapshot: AppSnapshot;
  metrics: ReturnType<typeof buildNavMetrics> | null;
  onSettings: () => void;
}) {
  const nav = [
    ["Dashboard", Sparkles],
    ["Library", Library],
    ["Spaces", FolderKanban],
    ["Review", Brain],
    ["Analytics", Gauge],
    ["Sync", RefreshCcw],
    ["Settings", Settings]
  ] as const;
  const libraryCount = (metrics?.sources.count ?? snapshot.sources.length) + (metrics?.packs.count ?? snapshot.packs.length);
  const navBadges: Partial<Record<NavLabel, string>> = {
    Library: String(libraryCount),
    Spaces: String(snapshot.spaces.length),
    Review: metrics?.dueCards.count ? String(metrics.dueCards.count) : undefined,
    Analytics: metrics?.weakAreas.count ? String(metrics.weakAreas.count) : undefined,
    Sync: metrics?.sync.label,
    Settings: metrics?.providers.ready ? String(metrics.providers.ready) : undefined
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <strong>OpenTurbo</strong>
          <span>Local-first AI Study Workspace</span>
        </div>
      </div>
      <nav>
        {nav.map(([label, Icon]) => (
          <Tooltip key={label} label={label} position="right" openDelay={250}>
            <button
              aria-current={active === label ? "page" : undefined}
              aria-label={label}
              className={`nav-item ${active === label ? "active" : ""}`}
              title={label}
              type="button"
              onClick={() => {
                setActive(label);
                if (label === "Settings") {
                  onSettings();
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {navBadges[label] && (
                <Badge size="xs" variant="light" color={label === "Sync" && snapshot.sync.state === "error" ? "red" : "teal"} style={{ marginLeft: "auto" }}>
                  {navBadges[label]}
                </Badge>
              )}
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="local-card">
          <Group gap={8}>
            <span className="status-dot" />
            <Text fw={700} size="sm">
              {snapshot.settings.privacyMode ? "Local mode" : "Cloud-assisted"}
            </Text>
          </Group>
          <Text size="xs" c="gray.5">
            {snapshot.sync.message}
          </Text>
        </div>
        <div className="storage-card">
          <Group justify="space-between">
            <Text size="xs" c="gray.4">
              Storage
            </Text>
            <Text size="xs" c="gray.4">
              178 GB free
            </Text>
          </Group>
          <Progress value={32} color="teal" size="sm" radius="xl" />
        </div>
      </div>
    </aside>
  );
}

function LibraryPane({
  snapshot,
  items,
  selectedSourceId,
  selectedPackId,
  selectedSpaceId,
  query,
  filter,
  favoriteIds,
  onSetQuery,
  onSetFilter,
  onSetSelectedSpace,
  onToggleFavorite,
  onSelectSource,
  onSelectPack,
  onImport
}: {
  snapshot: AppSnapshot;
  items: ReturnType<typeof filterLibraryItems>;
  selectedSourceId?: string;
  selectedPackId?: string;
  selectedSpaceId: string | null;
  query: string;
  filter: LibraryFilter;
  favoriteIds: string[];
  onSetQuery: (value: string) => void;
  onSetFilter: (value: LibraryFilter) => void;
  onSetSelectedSpace: (value: string | null) => void;
  onToggleFavorite: (id: string) => void;
  onSelectSource: (source: Source) => void;
  onSelectPack: (pack: StudyPack) => void;
  onImport: () => void;
}) {
  const favoriteSet = new Set(favoriteIds);
  const spaceOptions = [
    { label: "All spaces", value: "" },
    ...snapshot.spaces.map((space) => ({ label: space.name, value: space.id }))
  ];

  return (
    <section className="library-pane">
      <Group justify="space-between" className="pane-heading">
        <Text fw={800}>Library</Text>
        <Group gap={6}>
          <Tooltip label="Import source">
            <ActionIcon variant="filled" color="teal" onClick={onImport} aria-label="Import source">
              <Plus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <TextInput placeholder="Search library..." leftSection={<Search size={15} />} value={query} onChange={(event) => onSetQuery(event.currentTarget.value)} />
      <SegmentedControl
        fullWidth
        size="xs"
        data={["All", "Sources", "Packs", "Favorites"]}
        value={filter}
        onChange={(value) => onSetFilter(value as LibraryFilter)}
        className="library-filter"
      />
      <NativeSelect data={spaceOptions} value={selectedSpaceId ?? ""} onChange={(event) => onSetSelectedSpace(event.currentTarget.value || null)} size="xs" />
      <ScrollArea className="library-scroll">
        <Text className="section-label">Sources ({items.sourceCount})</Text>
        <Stack gap={6}>
          {items.sources.map((source) => (
            <Group key={source.id} gap={4} wrap="nowrap">
              <button className={`source-row ${selectedSourceId === source.id ? "selected" : ""}`} onClick={() => onSelectSource(source)}>
                <FileText size={18} />
                <span>
                  <strong>{source.title}</strong>
                  <small>
                    {source.kind.toUpperCase()} · {source.sizeLabel}
                  </small>
                </span>
                <span aria-hidden="true" />
              </button>
              <Tooltip label={favoriteSet.has(source.id) ? "Remove favorite" : "Favorite source"}>
                <ActionIcon
                  variant="subtle"
                  color={favoriteSet.has(source.id) ? "yellow" : "gray"}
                  aria-label={favoriteSet.has(source.id) ? `Remove ${source.title} from favorites` : `Favorite ${source.title}`}
                  onClick={() => onToggleFavorite(source.id)}
                >
                  <Star size={14} fill={favoriteSet.has(source.id) ? "currentColor" : "none"} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
          {items.sources.length === 0 && (
            <Text size="sm" c="dimmed">
              No sources match the current library controls.
            </Text>
          )}
        </Stack>
        <Text className="section-label">Study Packs ({items.packCount})</Text>
        <Stack gap={6}>
          {items.packs.map((pack) => (
            <Group key={pack.id} gap={4} wrap="nowrap">
              <button className={`source-row pack ${selectedPackId === pack.id ? "selected" : ""}`} onClick={() => onSelectPack(pack)}>
                <BookOpen size={18} />
                <span>
                  <strong>{pack.title}</strong>
                  <small>
                    {pack.flashcards.length} cards · {pack.quiz.length} quiz items
                  </small>
                </span>
                <Badge size="xs" color="teal">
                  {pack.mastery}%
                </Badge>
              </button>
              <Tooltip label={favoriteSet.has(pack.id) ? "Remove favorite" : "Favorite pack"}>
                <ActionIcon
                  variant="subtle"
                  color={favoriteSet.has(pack.id) ? "yellow" : "gray"}
                  aria-label={favoriteSet.has(pack.id) ? `Remove ${pack.title} from favorites` : `Favorite ${pack.title}`}
                  onClick={() => onToggleFavorite(pack.id)}
                >
                  <Star size={14} fill={favoriteSet.has(pack.id) ? "currentColor" : "none"} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
          {items.packs.length === 0 && (
            <Text size="sm" c="dimmed">
              No study packs match the current library controls.
            </Text>
          )}
        </Stack>
        <Text className="section-label">Tags</Text>
        <Group gap={6}>
          {[...new Set(snapshot.sources.flatMap((source) => source.tags))].map((tag) => (
            <Badge key={tag} variant="light" color="gray">
              {tag}
            </Badge>
          ))}
        </Group>
      </ScrollArea>
    </section>
  );
}

function FullWorkspaceSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="editor-pane nav-workspace-view" style={{ gridColumn: "1 / -1", overflow: "auto" }}>
      <header className="document-header">
        <div>
          <Text fw={900} size="lg">
            {title}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
      </header>
      <ScrollArea className="document-scroll">
        <Stack gap="md" p="md">
          {children}
        </Stack>
      </ScrollArea>
    </section>
  );
}

function SpacesView({ snapshot, selectedSpaceId, onFocusSpace }: { snapshot: AppSnapshot; selectedSpaceId: string | null; onFocusSpace: (spaceId: string | null) => void }) {
  const sourceCountBySpace = new Map(snapshot.spaces.map((space) => [space.id, snapshot.sources.filter((source) => source.spaceId === space.id).length]));
  const packCountBySpace = new Map(
    snapshot.spaces.map((space) => {
      const sourceIds = new Set(snapshot.sources.filter((source) => source.spaceId === space.id).map((source) => source.id));
      return [space.id, snapshot.packs.filter((pack) => sourceIds.has(pack.sourceId)).length];
    })
  );

  return (
    <FullWorkspaceSection title="Spaces" subtitle="Choose a workspace to focus the Library list.">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {snapshot.spaces.length} spaces · {snapshot.sources.length} sources · {snapshot.packs.length} study packs
        </Text>
        <Button variant="light" color="gray" onClick={() => onFocusSpace(null)}>
          Show all in Library
        </Button>
      </Group>
      <div className="card-grid">
        {snapshot.spaces.map((space) => {
          const sourceCount = sourceCountBySpace.get(space.id) ?? space.sourceCount;
          const packCount = packCountBySpace.get(space.id) ?? space.packCount;

          return (
            <Card key={space.id} radius={8} withBorder className={selectedSpaceId === space.id ? "selected" : ""}>
              <Group justify="space-between" align="start">
                <Group gap={10}>
                  <ThemeIcon radius={8} style={{ backgroundColor: space.color }}>
                    <FolderKanban size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={900}>{space.name}</Text>
                    <Text size="sm" c="dimmed">
                      {space.description}
                    </Text>
                  </div>
                </Group>
                {selectedSpaceId === space.id && (
                  <Badge variant="light" color="teal">
                    focused
                  </Badge>
                )}
              </Group>
              <Group mt="md" gap={8}>
                <Badge variant="light">{sourceCount} sources</Badge>
                <Badge variant="light" color="teal">
                  {packCount} packs
                </Badge>
                <Badge variant="light" color="gray">
                  Updated {new Date(space.updatedAt).toLocaleDateString()}
                </Badge>
              </Group>
              <Button mt="md" fullWidth variant="light" color="teal" onClick={() => onFocusSpace(space.id)}>
                Open in Library
              </Button>
            </Card>
          );
        })}
      </div>
    </FullWorkspaceSection>
  );
}

function ReviewView({
  dueCards,
  actionStatuses,
  onReview
}: {
  dueCards: ReturnType<typeof collectDueCards>;
  actionStatuses: ActionStatusMap;
  onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void | Promise<void>;
}) {
  return (
    <FullWorkspaceSection title="Review" subtitle={`${dueCards.length} due cards across your study packs.`}>
      {dueCards.length === 0 ? (
        <Card radius={8} withBorder>
          <Text fw={800}>Nothing due right now</Text>
          <Text size="sm" c="dimmed">
            New cards will appear here when their due date arrives.
          </Text>
        </Card>
      ) : (
        <div className="card-grid">
          {dueCards.map((dueCard) => {
            const status = actionStatuses[`review:${dueCard.id}`];
            const reviewing = status?.loading ?? false;

            return (
              <Card key={dueCard.id} radius={8} withBorder>
                <Group justify="space-between" gap={8}>
                  <Badge variant="light" color="teal">
                    {dueCard.pack.title}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {new Date(dueCard.dueAt).toLocaleDateString()}
                  </Text>
                </Group>
                <Text fw={900} mt="sm">
                  {dueCard.front}
                </Text>
                <Divider my="sm" />
                <Text size="sm">{dueCard.back}</Text>
                <Text size="xs" c="dimmed" mt="sm">
                  Source: {dueCard.source.title}
                </Text>
                <Group mt="md" gap={6}>
                  {(["again", "hard", "good", "easy"] as const).map((rating) => (
                    <Button
                      key={rating}
                      size="xs"
                      variant={rating === "good" ? "filled" : "light"}
                      color={rating === "again" ? "red" : "teal"}
                      onClick={() => void onReview(dueCard.card, rating)}
                      loading={reviewing}
                      disabled={reviewing}
                    >
                      {rating}
                    </Button>
                  ))}
                </Group>
                <ActionFeedback status={status} loadingMessage="Saving review..." />
              </Card>
            );
          })}
        </div>
      )}
    </FullWorkspaceSection>
  );
}

function AnalyticsView({ snapshot }: { snapshot: AppSnapshot }) {
  const analytics = snapshot.analytics;
  const chartData = analytics.masteryByTopic.length > 0 ? analytics.masteryByTopic : [{ topic: "No topics yet", mastery: 0 }];

  return (
    <FullWorkspaceSection title="Analytics" subtitle="Study workload, momentum, mastery, and weak areas.">
      <Group grow>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Cards due
          </Text>
          <Text fw={900} size="xl">
            {analytics.cardsDue}
          </Text>
        </Card>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Streak
          </Text>
          <Text fw={900} size="xl">
            {analytics.currentStreak} days
          </Text>
        </Card>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Weekly minutes
          </Text>
          <Text fw={900} size="xl">
            {analytics.weeklyStudyMinutes}
          </Text>
        </Card>
      </Group>
      <Card radius={8} withBorder>
        <Text fw={900} mb="sm">
          Mastery by topic
        </Text>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" />
            <YAxis domain={[0, 100]} />
            <ChartTooltip />
            <Bar dataKey="mastery" fill="#0f9f8f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card radius={8} withBorder>
        <Group justify="space-between">
          <Text fw={900}>Weak areas</Text>
          <Badge variant="light" color={analytics.weakAreas.length > 0 ? "yellow" : "teal"}>
            {analytics.weakAreas.length}
          </Badge>
        </Group>
        <Group gap={6} mt="sm">
          {analytics.weakAreas.length > 0 ? (
            analytics.weakAreas.map((area) => (
              <Badge key={area} variant="light" color="yellow">
                {area}
              </Badge>
            ))
          ) : (
            <Text size="sm" c="dimmed">
              No weak areas detected yet.
            </Text>
          )}
        </Group>
      </Card>
    </FullWorkspaceSection>
  );
}

function SyncView({
  snapshot,
  actionStatuses,
  settingsDraft,
  onSettingsDraftChange,
  onSave
}: {
  snapshot: AppSnapshot;
  actionStatuses: ActionStatusMap;
  settingsDraft: SettingsDraft;
  onSettingsDraftChange: (patch: Partial<SettingsDraft>) => void;
  onSave: (draft: SettingsDraft) => Promise<boolean>;
}) {
  const saving = actionStatuses.settingsSave?.loading ?? false;

  return (
    <FullWorkspaceSection title="Sync" subtitle={snapshot.sync.message}>
      <Group grow>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            State
          </Text>
          <Group gap={8} mt={4}>
            <Badge color={snapshot.sync.state === "error" ? "red" : snapshot.sync.enabled ? "teal" : "gray"}>{snapshot.sync.state}</Badge>
            <Text fw={800}>{snapshot.sync.enabled ? "Sync enabled" : "Local-only"}</Text>
          </Group>
        </Card>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Device
          </Text>
          <Text fw={900}>{snapshot.sync.deviceId}</Text>
        </Card>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Last sync
          </Text>
          <Text fw={900}>{snapshot.sync.lastSyncAt ? new Date(snapshot.sync.lastSyncAt).toLocaleString() : "Not synced"}</Text>
        </Card>
      </Group>
      <Card radius={8} withBorder>
        <Stack>
          <Switch
            label="Privacy mode"
            description="Prefer local runtimes and warn before cloud calls."
            checked={settingsDraft.privacyMode}
            onChange={(event) => onSettingsDraftChange({ privacyMode: event.currentTarget.checked })}
          />
          <TextInput
            label="Sync server URL"
            placeholder="http://localhost:8787"
            value={settingsDraft.syncServerUrl}
            onChange={(event) => onSettingsDraftChange({ syncServerUrl: event.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button onClick={() => void onSave(settingsDraft)} loading={saving} disabled={saving}>
              Save sync settings
            </Button>
          </Group>
          <ActionFeedback status={actionStatuses.settingsSave} loadingMessage="Saving settings..." />
        </Stack>
      </Card>
    </FullWorkspaceSection>
  );
}

function SettingsOverview({
  snapshot,
  providerHealth,
  providerTestResults,
  actionStatuses,
  onProviderHealth,
  onOpenSettings,
  onTestProvider
}: {
  snapshot: AppSnapshot;
  providerHealth: ProviderHealthResult | null;
  providerTestResults: Record<string, ProviderHealthItem>;
  actionStatuses: ActionStatusMap;
  onProviderHealth: () => void | Promise<void>;
  onOpenSettings: () => void;
  onTestProvider: (providerId: string) => void | Promise<void>;
}) {
  const metrics = buildNavMetrics(snapshot);
  const healthLoading = actionStatuses.providerHealth?.loading ?? false;

  return (
    <FullWorkspaceSection title="Settings" subtitle="Provider, privacy, storage, and sync overview.">
      <Group justify="space-between">
        <Group gap={8}>
          <Badge variant="light" color="teal">
            {metrics.providers.label}
          </Badge>
          <Badge variant="light" color={snapshot.settings.privacyMode ? "green" : "yellow"}>
            {snapshot.settings.privacyMode ? "Privacy mode" : "Cloud-assisted"}
          </Badge>
          <Badge variant="light" color={snapshot.sync.enabled ? "teal" : "gray"}>
            {metrics.sync.label}
          </Badge>
        </Group>
        <Group>
          <Button variant="light" leftSection={<RefreshCcw size={16} />} onClick={() => void onProviderHealth()} loading={healthLoading} disabled={healthLoading}>
            Refresh providers
          </Button>
          <Button leftSection={<Settings size={16} />} onClick={onOpenSettings}>
            Open drawer
          </Button>
        </Group>
      </Group>
      <Group grow>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            Local database
          </Text>
          <Text fw={800}>{snapshot.settings.dataPath}</Text>
        </Card>
        <Card radius={8} withBorder>
          <Text size="xs" c="dimmed">
            File storage
          </Text>
          <Text fw={800}>{snapshot.settings.fileStoragePath}</Text>
        </Card>
      </Group>
      <Stack gap="sm">
        {snapshot.settings.providers.map((providerConfig) => {
          const testKey = `providerTest:${providerConfig.id}`;
          const testing = actionStatuses[testKey]?.loading ?? false;
          const testResult = providerTestResults[providerConfig.id];

          return (
            <Card key={providerConfig.id} radius={8} withBorder>
              <Group justify="space-between" align="start">
                <div>
                  <Text fw={900}>{providerConfig.label}</Text>
                  <Text size="xs" c="dimmed">
                    {providerConfig.kind} · {providerConfig.baseUrl ?? "no base URL"} · {providerConfig.chatModel ?? "no model"}
                  </Text>
                </div>
                <Group gap={8}>
                  <Badge color={providerConfig.enabled ? "green" : "gray"}>{providerConfig.enabled ? "enabled" : "disabled"}</Badge>
                  {providerConfig.isDefault && (
                    <Badge variant="light" color="teal">
                      default
                    </Badge>
                  )}
                  <Button size="xs" variant="light" onClick={() => void onTestProvider(providerConfig.id)} loading={testing} disabled={testing}>
                    Test
                  </Button>
                </Group>
              </Group>
              {testResult && (
                <Group gap={6} mt="sm">
                  <Badge size="xs" color={testResult.ok ? "green" : "red"}>
                    {testResult.ok ? "ok" : "issue"}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {testResult.message}
                  </Text>
                </Group>
              )}
              <ActionFeedback status={actionStatuses[testKey]} loadingMessage="Testing provider..." />
            </Card>
          );
        })}
      </Stack>
      {providerHealth && (
        <Card radius={8} withBorder>
          <Text fw={900} mb="sm">
            Last provider health refresh
          </Text>
          <Stack gap={6}>
            {providerHealth.map((health) => (
              <Group key={`${health.kind}-${health.label}`} gap={8}>
                <Badge size="xs" color={health.ok ? "green" : "red"}>
                  {health.ok ? "ok" : "issue"}
                </Badge>
                <Text size="sm">
                  {health.label}: {health.message}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
      <ActionFeedback status={actionStatuses.providerHealth} loadingMessage="Checking providers..." />
    </FullWorkspaceSection>
  );
}

function EditorPane({
  activeTab,
  setActiveTab,
  source,
  pack,
  onGenerate,
  onReview,
  onExport,
  actionStatuses,
  hasProvider
}: {
  activeTab: StudyTab;
  setActiveTab: (tab: StudyTab) => void;
  source?: Source;
  pack?: StudyPack;
  onGenerate: (outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) => void | Promise<void>;
  onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void | Promise<void>;
  onExport: (format: "markdown" | "json" | "anki-csv") => void | Promise<void>;
  actionStatuses: ActionStatusMap;
  hasProvider: boolean;
}) {
  const generating = actionStatuses.generate?.loading ?? false;
  const markdownExporting = actionStatuses["export:markdown"]?.loading ?? false;
  const ankiExporting = actionStatuses["export:anki-csv"]?.loading ?? false;

  if (!source || !pack) {
    return (
      <section className="editor-pane empty">
        <Text fw={800}>Import a source to begin</Text>
        <Button leftSection={<Upload size={16} />} onClick={() => onGenerate(["notes"])} loading={generating} disabled={!source || !hasProvider || generating}>
          Generate study pack
        </Button>
        {!hasProvider && (
          <Text size="sm" c="red">
            Configure a provider before generating.
          </Text>
        )}
        <ActionFeedback status={actionStatuses.generate} loadingMessage="Generating study pack..." />
      </section>
    );
  }

  return (
    <section className="editor-pane">
      <header className="document-header">
        <Group gap={8}>
          <div>
            <Text fw={900} size="lg">
              {source.title}
            </Text>
            <Text size="xs" c="dimmed">
              Library / Sources · {source.kind.toUpperCase()} · {source.sizeLabel}
            </Text>
          </div>
        </Group>
        <Group>
          <Button variant="light" color="gray" leftSection={<Download size={15} />} onClick={() => onExport("markdown")} loading={markdownExporting} disabled={markdownExporting || ankiExporting}>
            Markdown
          </Button>
          <Button variant="light" color="gray" leftSection={<Download size={15} />} onClick={() => onExport("anki-csv")} loading={ankiExporting} disabled={markdownExporting || ankiExporting}>
            Anki
          </Button>
        </Group>
      </header>
      <Tabs value={activeTab} onChange={(value) => setActiveTab((value ?? "notes") as StudyTab)} className="study-tabs">
        <Tabs.List>
          <Tabs.Tab value="notes" leftSection={<FileText size={15} />}>
            Notes
          </Tabs.Tab>
          <Tabs.Tab value="flashcards" leftSection={<BookOpen size={15} />}>
            Flashcards
          </Tabs.Tab>
          <Tabs.Tab value="quiz" leftSection={<Check size={15} />}>
            Quiz
          </Tabs.Tab>
          <Tabs.Tab value="mindmap" leftSection={<Network size={15} />}>
            Mind map
          </Tabs.Tab>
          <Tabs.Tab value="podcast" leftSection={<AudioLines size={15} />}>
            Podcast
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <div className="toolbar">
        <Tooltip label="Formatting controls are not saved yet.">
          <div>
            <NativeSelect data={["Heading 2", "Body", "Quote", "Equation"]} size="xs" disabled />
          </div>
        </Tooltip>
        <Tooltip label="Formatting controls are not saved yet.">
          <Button size="xs" variant="subtle" disabled>
            B
          </Button>
        </Tooltip>
        <Tooltip label="Formatting controls are not saved yet.">
          <Button size="xs" variant="subtle" disabled>
            I
          </Button>
        </Tooltip>
        <Tooltip label="Code formatting is not saved yet.">
          <Button size="xs" variant="subtle" disabled>
            Code
          </Button>
        </Tooltip>
        <Button size="xs" variant="subtle" leftSection={<Sparkles size={14} />} onClick={() => onGenerate(["notes", "flashcards", "quiz"])} loading={generating} disabled={!hasProvider || generating}>
          Regenerate
        </Button>
      </div>
      <Stack gap={6} px="md" pt="xs">
        <ActionFeedback status={actionStatuses.generate} loadingMessage="Generating study pack..." />
        <ActionFeedback status={actionStatuses["export:markdown"]} loadingMessage="Exporting markdown..." />
        <ActionFeedback status={actionStatuses["export:anki-csv"]} loadingMessage="Exporting Anki CSV..." />
        {!hasProvider && (
          <Text size="sm" c="red">
            Configure a provider before generating.
          </Text>
        )}
      </Stack>
      <ScrollArea className="document-scroll">
        {activeTab === "notes" && <NotesView pack={pack} />}
        {activeTab === "flashcards" && <FlashcardsView pack={pack} onReview={onReview} actionStatuses={actionStatuses} />}
        {activeTab === "quiz" && <QuizView pack={pack} />}
        {activeTab === "mindmap" && <MindMapView root={pack.mindMap} />}
        {activeTab === "podcast" && <PodcastView pack={pack} />}
      </ScrollArea>
      <footer className="editor-status">
        <span>Words: {pack.sections.map((section) => section.body.split(/\s+/).length).reduce((a, b) => a + b, 0)}</span>
        <span>Auto-saved locally</span>
        <span>
          <Check size={14} /> All changes saved
        </span>
      </footer>
    </section>
  );
}

function NotesView({ pack }: { pack: StudyPack }) {
  return (
    <article className="notes-view">
      {pack.sections.map((section, index) => (
        <section key={section.id}>
          <h2>
            {index + 1}. {section.heading}
          </h2>
          {section.body.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Group gap={6}>
            {section.citations.map((citation) => (
              <Badge key={citation.label} variant="light" color="red" leftSection={<FileText size={12} />}>
                {citation.label}
              </Badge>
            ))}
          </Group>
        </section>
      ))}
    </article>
  );
}

function FlashcardsView({ pack, onReview, actionStatuses }: { pack: StudyPack; onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void | Promise<void>; actionStatuses: ActionStatusMap }) {
  return (
    <div className="card-grid">
      {pack.flashcards.map((card) => {
        const status = actionStatuses[`review:${card.id}`];
        const reviewing = status?.loading ?? false;

        return (
          <Card key={card.id} radius={8} withBorder>
            <Text size="xs" c="dimmed">
              Due {new Date(card.dueAt).toLocaleDateString()}
            </Text>
            <Text fw={800} mt="xs">
              {card.front}
            </Text>
            <Divider my="sm" />
            <Text size="sm">{card.back}</Text>
            <Group mt="md" gap={6}>
              {(["again", "hard", "good", "easy"] as const).map((rating) => (
                <Button key={rating} size="xs" variant={rating === "good" ? "filled" : "light"} color={rating === "again" ? "red" : "teal"} onClick={() => void onReview(card, rating)} loading={reviewing} disabled={reviewing}>
                  {rating}
                </Button>
              ))}
            </Group>
            <ActionFeedback status={status} loadingMessage="Saving review..." />
          </Card>
        );
      })}
    </div>
  );
}

function MindMapView({ root }: { root: MindMapNode }) {
  const { nodes, edges } = useMemo(() => mindMapToFlow(root), [root]);
  return (
    <div className="mindmap">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function PodcastView({ pack }: { pack: StudyPack }) {
  return (
    <div className="podcast-view">
      <ThemeIcon size={58} radius={8} color="teal">
        <Mic size={30} />
      </ThemeIcon>
      <div>
        <Text fw={900} size="xl">
          {pack.title} Audio Recap
        </Text>
        <Text c="dimmed">Podcast script is ready for local or BYOK TTS generation.</Text>
      </div>
      <Card radius={8} withBorder>
        <Text>{pack.podcastScript}</Text>
      </Card>
      <Progress value={38} color="teal" />
      <Group>
        <Tooltip label="Audio preview is not implemented yet">
          <span>
            <Button leftSection={<AudioLines size={16} />} disabled aria-label="Preview script unavailable">
              Preview unavailable
            </Button>
          </span>
        </Tooltip>
        <Tooltip label="Audio export is not implemented yet">
          <span>
            <Button variant="light" leftSection={<Download size={16} />} disabled aria-label="Export audio unavailable">
              Export unavailable
            </Button>
          </span>
        </Tooltip>
      </Group>
    </div>
  );
}

function AssistantPane({
  provider,
  pack,
  chats,
  chatText,
  setChatText,
  onChat,
  onGenerate,
  onProviderHealth,
  providerHealth,
  actionStatuses
}: {
  provider?: ProviderConfig;
  pack?: StudyPack;
  chats: ChatMessage[];
  chatText: string;
  setChatText: (value: string) => void;
  onChat: () => void | Promise<void>;
  onGenerate: (outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) => void | Promise<void>;
  onProviderHealth: () => void | Promise<void>;
  providerHealth: ProviderHealthResult | null;
  actionStatuses: ActionStatusMap;
}) {
  const chatLoading = actionStatuses.chat?.loading ?? false;
  const generateLoading = actionStatuses.generate?.loading ?? false;
  const healthLoading = actionStatuses.providerHealth?.loading ?? false;
  const canChat = Boolean(pack && provider && chatText.trim() && !chatLoading);
  const canGenerate = Boolean(pack && provider && !generateLoading);

  return (
    <aside className="assistant-pane">
      <Group justify="space-between" className="pane-heading">
        <Text fw={900}>AI Assistant</Text>
        <ActionIcon variant="subtle" color="gray" onClick={onProviderHealth} loading={healthLoading} disabled={healthLoading} aria-label="Refresh provider health">
          <RefreshCcw size={16} />
        </ActionIcon>
      </Group>
      <Card radius={8} withBorder className="provider-card">
        <Group justify="space-between">
          <Text size="sm" fw={800}>
            Provider ({provider?.kind ?? "local"})
          </Text>
          <Badge color={provider?.enabled ? "green" : "gray"}>{provider?.enabled ? "Ready" : "Disabled"}</Badge>
        </Group>
        <Group mt="sm">
          <ThemeIcon color="teal" variant="light">
            <Zap size={18} />
          </ThemeIcon>
          <div>
            <Text fw={800}>{provider?.label ?? "No provider"}</Text>
            <Text size="xs" c="dimmed">
              {provider?.chatModel ?? "Configure a model"} · BYOK/local compatible
            </Text>
          </div>
        </Group>
        {Boolean(providerHealth) && (
          <Stack gap={4} mt="xs">
            {providerHealth?.map((health) => (
              <Group key={`${health.kind}-${health.label}`} gap={6}>
                <Badge size="xs" color={health.ok ? "green" : "red"}>
                  {health.ok ? "ok" : "issue"}
                </Badge>
                <Text size="xs" c="dimmed">
                  {health.label}: {health.message}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
        <ActionFeedback status={actionStatuses.providerHealth} loadingMessage="Checking providers..." />
      </Card>
      <Card radius={8} withBorder className="chat-card">
        <Text fw={800} size="sm">
          Chat over your sources
        </Text>
        <ScrollArea className="chat-scroll">
          {chats.slice(-6).map((message) => (
            <div className={`chat-bubble ${message.role}`} key={message.id}>
              <Text size="sm">{message.content}</Text>
              {message.citations.length > 0 && (
                <Group gap={5} mt={6}>
                  {message.citations.map((citation) => (
                    <Badge key={citation.label} size="xs" variant="light">
                      {citation.label}
                    </Badge>
                  ))}
                </Group>
              )}
            </div>
          ))}
        </ScrollArea>
        <Group gap={6}>
          <TextInput
            className="chat-input"
            placeholder="Ask anything about your sources..."
            value={chatText}
            onChange={(event) => setChatText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canChat) {
                void onChat();
              }
            }}
            disabled={chatLoading || !pack || !provider}
          />
          <ActionIcon size={36} color="teal" onClick={onChat} loading={chatLoading} disabled={!canChat} aria-label="Send chat message">
            <MessageSquareText size={17} />
          </ActionIcon>
        </Group>
        <ActionFeedback status={actionStatuses.chat} loadingMessage="Asking assistant..." />
        {!pack && (
          <Text size="xs" c="dimmed">
            Select a study pack before chatting.
          </Text>
        )}
        {!provider && (
          <Text size="xs" c="red">
            Configure a provider before chatting.
          </Text>
        )}
      </Card>
      <Text fw={900}>AI Actions</Text>
      <div className="action-grid">
        <Button variant="light" color="teal" leftSection={<BookOpen size={16} />} onClick={() => onGenerate(["flashcards"])} loading={generateLoading} disabled={!canGenerate}>
          Flashcards
        </Button>
        <Button variant="light" color="yellow" leftSection={<Check size={16} />} onClick={() => onGenerate(["quiz"])} loading={generateLoading} disabled={!canGenerate}>
          Quiz
        </Button>
        <Button variant="light" color="blue" leftSection={<Mic size={16} />} onClick={() => onGenerate(["podcast"])} loading={generateLoading} disabled={!canGenerate}>
          Podcast
        </Button>
        <Button variant="light" color="gray" leftSection={<FileText size={16} />} onClick={() => onGenerate(["notes"])} loading={generateLoading} disabled={!canGenerate}>
          Notes
        </Button>
      </div>
      <ActionFeedback status={actionStatuses.generate} loadingMessage="Generating study material..." />
      {pack && (
        <Card radius={8} withBorder>
          <Group justify="space-between">
            <Text fw={800}>Mastery</Text>
            <RingProgress size={74} thickness={8} sections={[{ value: pack.mastery, color: "teal" }]} label={<Text ta="center" size="xs" fw={800}>{pack.mastery}%</Text>} />
          </Group>
        </Card>
      )}
    </aside>
  );
}

function JobQueue({ jobs, analytics }: { jobs: AppSnapshot["jobs"]; analytics: AppSnapshot["analytics"] }) {
  const chartData = analytics.masteryByTopic.map((item, index) => ({ ...item, minutes: [42, 58, 31, 55, 68][index % 5] }));
  return (
    <footer className="job-queue">
      <Group justify="space-between">
        <Group>
          <Text fw={900}>Job Queue ({jobs.length})</Text>
          <Badge variant="light" color="teal">
            {analytics.cardsDue} cards due
          </Badge>
          <Badge variant="light" color="yellow">
            {analytics.currentStreak} day streak
          </Badge>
        </Group>
        <Group>
          <Activity size={15} />
          <Text size="xs">CPU 38%</Text>
          <Text size="xs">RAM 11.2 / 32 GB</Text>
          <WifiOff size={15} />
        </Group>
      </Group>
      <div className="queue-grid">
        {jobs.slice(0, 4).map((job) => (
          <Card radius={8} withBorder key={job.id} className="job-card">
            <Group justify="space-between">
              <Text fw={800} size="sm">
                {job.label}
              </Text>
              <Badge color={job.status === "completed" ? "green" : "teal"} size="xs">
                {job.status}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {job.detail}
            </Text>
            <Progress value={job.progress} color={job.status === "failed" ? "red" : "teal"} mt="sm" />
          </Card>
        ))}
        <Card radius={8} withBorder className="chart-card">
          <ResponsiveContainer width="100%" height={72}>
            <AreaChart data={chartData}>
              <Area type="monotone" dataKey="mastery" stroke="#0f9f8f" fill="#b7eee7" />
              <ChartTooltip />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </footer>
  );
}

function SettingsDrawer({
  snapshot,
  opened,
  onClose,
  onSave,
  onTestProvider,
  providerTestResults,
  actionStatuses,
  settingsDraft,
  onSettingsDraftChange
}: {
  snapshot: AppSnapshot;
  opened: boolean;
  onClose: () => void;
  onSave: (draft: SettingsDraft) => Promise<boolean>;
  onTestProvider: (providerId: string) => void | Promise<void>;
  providerTestResults: Record<string, ProviderHealthItem>;
  actionStatuses: ActionStatusMap;
  settingsDraft: SettingsDraft;
  onSettingsDraftChange: (patch: Partial<SettingsDraft>) => void;
}) {
  const saving = actionStatuses.settingsSave?.loading ?? false;

  async function save() {
    const saved = await onSave(settingsDraft);
    if (saved) {
      onClose();
    }
  }

  return (
    <Drawer opened={opened} onClose={onClose} title="Settings" position="right" size="xl" closeButtonProps={{ "aria-label": "Close settings" }}>
      <Stack>
        <Switch
          label="Privacy mode"
          description="Prefer local runtimes and warn before cloud calls."
          checked={settingsDraft.privacyMode}
          onChange={(event) => onSettingsDraftChange({ privacyMode: event.currentTarget.checked })}
        />
        <TextInput
          label="Sync server URL"
          placeholder="http://localhost:8787"
          value={settingsDraft.syncServerUrl}
          onChange={(event) => onSettingsDraftChange({ syncServerUrl: event.currentTarget.value })}
        />
        <TextInput label="Local database" value={snapshot.settings.dataPath} readOnly />
        <TextInput label="File storage" value={snapshot.settings.fileStoragePath} readOnly />
        <Divider label="AI providers" />
        {snapshot.settings.providers.map((provider) => {
          const testKey = `providerTest:${provider.id}`;
          const testing = actionStatuses[testKey]?.loading ?? false;
          const testResult = providerTestResults[provider.id];

          return (
          <Card radius={8} withBorder key={provider.id}>
            <Group justify="space-between">
              <div>
                <Text fw={800}>{provider.label}</Text>
                <Text size="xs" c="dimmed">
                  {provider.kind} · {provider.baseUrl ?? "no base URL"} · {provider.chatModel ?? "no model"}
                </Text>
              </div>
              <Group gap={8}>
                <Badge color={provider.enabled ? "green" : "gray"}>{provider.enabled ? "enabled" : "disabled"}</Badge>
                <Button size="xs" variant="light" onClick={() => onTestProvider(provider.id)} loading={testing} disabled={!provider.id || testing}>
                  Test
                </Button>
              </Group>
            </Group>
            {testResult && (
              <Group gap={6} mt="sm">
                <Badge size="xs" color={testResult.ok ? "green" : "red"}>
                  {testResult.ok ? "ok" : "issue"}
                </Badge>
                <Text size="xs" c="dimmed">
                  {testResult.message}
                </Text>
              </Group>
            )}
            <ActionFeedback status={actionStatuses[testKey]} loadingMessage="Testing provider..." />
          </Card>
          );
        })}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={snapshot.analytics.masteryByTopic}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" hide />
            <YAxis />
            <ChartTooltip />
            <Bar dataKey="mastery" fill="#0f9f8f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <ActionFeedback status={actionStatuses.settingsSave} loadingMessage="Saving settings..." />
        <Button onClick={save} loading={saving} disabled={saving}>
          Save settings
        </Button>
      </Stack>
    </Drawer>
  );
}

function sourcesForSpace(snapshot: AppSnapshot, spaceId: string | null): Source[] {
  return spaceId ? snapshot.sources.filter((source) => source.spaceId === spaceId) : snapshot.sources;
}

function settingsDraftFromSnapshot(snapshot: AppSnapshot): SettingsDraft {
  return {
    syncServerUrl: snapshot.settings.syncServerUrl,
    privacyMode: snapshot.settings.privacyMode
  };
}

function ActionFeedback({ status, loadingMessage }: { status?: ActionStatus; loadingMessage: string }) {
  const message = getActionMessage(status, loadingMessage);

  if (!message) {
    return null;
  }

  return (
    <Alert color={message.color} title={message.title} radius={8} variant="light">
      {message.body}
    </Alert>
  );
}

function getActionMessage(status: ActionStatus | undefined, loadingMessage: string): { color: string; title: string; body: string } | null {
  if (!status) {
    return null;
  }
  if (status.loading) {
    return { color: "blue", title: "Working", body: loadingMessage };
  }
  if (status.error) {
    return { color: "red", title: "Needs attention", body: status.error };
  }
  if (status.success) {
    return { color: "green", title: "Done", body: status.success };
  }
  return null;
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "Action failed.";
}

function mindMapToFlow(root: MindMapNode): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const walk = (node: MindMapNode, depth: number, index: number, parent?: MindMapNode) => {
    nodes.push({
      id: node.id,
      data: { label: node.label },
      position: { x: depth * 220, y: index * 95 },
      style: {
        border: "1px solid #b8d9d4",
        borderRadius: 8,
        padding: 10,
        fontWeight: 700,
        background: depth === 0 ? "#0f9f8f" : "#ffffff",
        color: depth === 0 ? "#ffffff" : "#15202b"
      }
    });
    if (parent) {
      edges.push({ id: `${parent.id}-${node.id}`, source: parent.id, target: node.id, animated: depth === 1 });
    }
    node.children.forEach((child, childIndex) => walk(child, depth + 1, index + childIndex - node.children.length / 2, node));
  };
  walk(root, 0, 3);
  return { nodes, edges };
}

export default App;
