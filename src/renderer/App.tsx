import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import "./App.css";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionIcon,
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
  ChevronLeft,
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
import type { AppSnapshot, ChatMessage, Flashcard, MindMapNode, ProviderConfig, Source, StudyPack, StudyTab } from "../shared/types.js";

const client = createClient();

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [activeNav, setActiveNav] = useState("Library");
  const [activeTab, setActiveTab] = useState<StudyTab>("notes");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("Lecture notes");
  const [importText, setImportText] = useState("");
  const [chatText, setChatText] = useState("");
  const [providerHealth, setProviderHealth] = useState<unknown>(null);

  const refresh = async () => {
    const next = await client.snapshot();
    setSnapshot(next);
    setSelectedSourceId((current) => current ?? next.sources[0]?.id ?? null);
    setSelectedPackId((current) => current ?? next.packs[0]?.id ?? null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedSource = snapshot?.sources.find((source) => source.id === selectedSourceId) ?? snapshot?.sources[0];
  const selectedPack = snapshot?.packs.find((pack) => pack.id === selectedPackId) ?? snapshot?.packs.find((pack) => pack.sourceId === selectedSource?.id) ?? snapshot?.packs[0];
  const defaultProvider = snapshot?.settings.providers.find((provider) => provider.isDefault) ?? snapshot?.settings.providers[0];

  async function handleImport() {
    if (!snapshot || !importText.trim()) {
      return;
    }
    const source = await client.importText({
      title: importTitle,
      text: importText,
      spaceId: snapshot.spaces[0]?.id ?? "space_default",
      tags: importTitle.toLowerCase().split(/\s+/).slice(0, 3)
    });
    const pack = await client.generate({ sourceId: source.id, outputs: ["notes", "flashcards", "quiz", "mindmap", "podcast"] });
    setSelectedSourceId(source.id);
    setSelectedPackId(pack.id);
    setImportText("");
    setImportOpen(false);
    await refresh();
  }

  async function handleGenerate(outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) {
    if (!selectedSource) {
      return;
    }
    const pack = await client.generate({ sourceId: selectedSource.id, outputs });
    setSelectedPackId(pack.id);
    await refresh();
  }

  async function handleChat() {
    if (!selectedPack || !chatText.trim()) {
      return;
    }
    await client.chat({ scopeId: selectedPack.id, message: chatText });
    setChatText("");
    await refresh();
  }

  async function handleReview(card: Flashcard, rating: "again" | "hard" | "good" | "easy") {
    await client.review({ cardId: card.id, rating });
    await refresh();
  }

  async function handleExport(format: "markdown" | "json" | "anki-csv") {
    if (selectedPack) {
      await client.exportPack(selectedPack.id, format);
      await refresh();
    }
  }

  async function handleProviderHealth() {
    setProviderHealth(await client.providerHealth());
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
        <Sidebar active={activeNav} setActive={setActiveNav} snapshot={snapshot} onSettings={() => setSettingsOpen(true)} />
        <main className="workspace">
          <LibraryPane
            snapshot={snapshot}
            selectedSourceId={selectedSource?.id}
            selectedPackId={selectedPack?.id}
            onSelectSource={(source) => {
              setSelectedSourceId(source.id);
              const pack = snapshot.packs.find((candidate) => candidate.sourceId === source.id);
              if (pack) {
                setSelectedPackId(pack.id);
              }
            }}
            onSelectPack={(pack) => {
              setSelectedPackId(pack.id);
              setSelectedSourceId(pack.sourceId);
            }}
            onImport={() => setImportOpen(true)}
          />
          <EditorPane
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            source={selectedSource}
            pack={selectedPack}
            onGenerate={handleGenerate}
            onReview={handleReview}
            onExport={handleExport}
          />
          <AssistantPane
            provider={defaultProvider}
            pack={selectedPack}
            chats={snapshot.chats}
            chatText={chatText}
            setChatText={setChatText}
            onChat={handleChat}
            onGenerate={handleGenerate}
            onProviderHealth={handleProviderHealth}
            providerHealth={providerHealth}
          />
        </main>
        <JobQueue jobs={snapshot.jobs} analytics={snapshot.analytics} />
      </div>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title="Import source" size="lg" radius={8}>
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
            <Button leftSection={<Upload size={16} />} onClick={handleImport}>
              Import and generate
            </Button>
          </Group>
        </Stack>
      </Modal>

      <SettingsDrawer snapshot={snapshot} opened={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={refresh} />
    </MantineProvider>
  );
}

function Sidebar({ active, setActive, snapshot, onSettings }: { active: string; setActive: (value: string) => void; snapshot: AppSnapshot; onSettings: () => void }) {
  const nav = [
    ["Library", Library],
    ["Spaces", FolderKanban],
    ["Review", Brain],
    ["Analytics", Gauge],
    ["Sync", RefreshCcw],
    ["Settings", Settings]
  ] as const;
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
          <button
            className={`nav-item ${active === label ? "active" : ""}`}
            key={label}
            onClick={() => {
              setActive(label);
              if (label === "Settings") {
                onSettings();
              }
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
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
  selectedSourceId,
  selectedPackId,
  onSelectSource,
  onSelectPack,
  onImport
}: {
  snapshot: AppSnapshot;
  selectedSourceId?: string;
  selectedPackId?: string;
  onSelectSource: (source: Source) => void;
  onSelectPack: (pack: StudyPack) => void;
  onImport: () => void;
}) {
  return (
    <section className="library-pane">
      <Group justify="space-between" className="pane-heading">
        <Text fw={800}>Library</Text>
        <Group gap={6}>
          <Tooltip label="Search">
            <ActionIcon variant="default">
              <Search size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Import source">
            <ActionIcon variant="filled" color="teal" onClick={onImport}>
              <Plus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <TextInput placeholder="Search library..." leftSection={<Search size={15} />} />
      <SegmentedControl fullWidth size="xs" data={["All", "Sources", "Packs", "Favorites"]} className="library-filter" />
      <ScrollArea className="library-scroll">
        <Text className="section-label">Sources</Text>
        <Stack gap={6}>
          {snapshot.sources.map((source) => (
            <button className={`source-row ${selectedSourceId === source.id ? "selected" : ""}`} key={source.id} onClick={() => onSelectSource(source)}>
              <FileText size={18} />
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.kind.toUpperCase()} · {source.sizeLabel}
                </small>
              </span>
              <Star size={14} />
            </button>
          ))}
        </Stack>
        <Text className="section-label">Study Packs</Text>
        <Stack gap={6}>
          {snapshot.packs.map((pack) => (
            <button className={`source-row pack ${selectedPackId === pack.id ? "selected" : ""}`} key={pack.id} onClick={() => onSelectPack(pack)}>
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
          ))}
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

function EditorPane({
  activeTab,
  setActiveTab,
  source,
  pack,
  onGenerate,
  onReview,
  onExport
}: {
  activeTab: StudyTab;
  setActiveTab: (tab: StudyTab) => void;
  source?: Source;
  pack?: StudyPack;
  onGenerate: (outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) => void;
  onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void;
  onExport: (format: "markdown" | "json" | "anki-csv") => void;
}) {
  if (!source || !pack) {
    return (
      <section className="editor-pane empty">
        <Text fw={800}>Import a source to begin</Text>
        <Button leftSection={<Upload size={16} />} onClick={() => onGenerate(["notes"])}>
          Generate study pack
        </Button>
      </section>
    );
  }

  return (
    <section className="editor-pane">
      <header className="document-header">
        <Group gap={8}>
          <ActionIcon variant="subtle" color="gray">
            <ChevronLeft size={18} />
          </ActionIcon>
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
          <Button variant="light" color="gray" leftSection={<Download size={15} />} onClick={() => onExport("markdown")}>
            Markdown
          </Button>
          <Button variant="light" color="gray" leftSection={<Download size={15} />} onClick={() => onExport("anki-csv")}>
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
        <NativeSelect data={["Heading 2", "Body", "Quote", "Equation"]} size="xs" />
        <Button size="xs" variant="subtle">
          B
        </Button>
        <Button size="xs" variant="subtle">
          I
        </Button>
        <Button size="xs" variant="subtle">
          Code
        </Button>
        <Button size="xs" variant="subtle" leftSection={<Sparkles size={14} />} onClick={() => onGenerate(["notes", "flashcards", "quiz"])}>
          Regenerate
        </Button>
      </div>
      <ScrollArea className="document-scroll">
        {activeTab === "notes" && <NotesView pack={pack} />}
        {activeTab === "flashcards" && <FlashcardsView pack={pack} onReview={onReview} />}
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

function FlashcardsView({ pack, onReview }: { pack: StudyPack; onReview: (card: Flashcard, rating: "again" | "hard" | "good" | "easy") => void }) {
  return (
    <div className="card-grid">
      {pack.flashcards.map((card) => (
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
              <Button key={rating} size="xs" variant={rating === "good" ? "filled" : "light"} color={rating === "again" ? "red" : "teal"} onClick={() => onReview(card, rating)}>
                {rating}
              </Button>
            ))}
          </Group>
        </Card>
      ))}
    </div>
  );
}

function QuizView({ pack }: { pack: StudyPack }) {
  return (
    <Stack gap="md" p="md">
      {pack.quiz.map((question, index) => (
        <Card key={question.id} radius={8} withBorder>
          <Text fw={800}>
            {index + 1}. {question.prompt}
          </Text>
          <Stack gap={6} mt="sm">
            {question.choices.map((choice, choiceIndex) => (
              <div className={`choice ${choiceIndex === question.answerIndex ? "correct" : ""}`} key={choice}>
                {choice}
              </div>
            ))}
          </Stack>
          <Text size="sm" c="dimmed" mt="sm">
            {question.explanation}
          </Text>
        </Card>
      ))}
    </Stack>
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
        <Button leftSection={<AudioLines size={16} />}>Preview script</Button>
        <Button variant="light" leftSection={<Download size={16} />}>
          Export audio
        </Button>
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
  providerHealth
}: {
  provider?: ProviderConfig;
  pack?: StudyPack;
  chats: ChatMessage[];
  chatText: string;
  setChatText: (value: string) => void;
  onChat: () => void;
  onGenerate: (outputs: Array<"notes" | "flashcards" | "quiz" | "mindmap" | "podcast">) => void;
  onProviderHealth: () => void;
  providerHealth: unknown;
}) {
  return (
    <aside className="assistant-pane">
      <Group justify="space-between" className="pane-heading">
        <Text fw={900}>AI Assistant</Text>
        <ActionIcon variant="subtle" color="gray" onClick={onProviderHealth}>
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
          <Text size="xs" c="dimmed" mt="xs">
            Provider health refreshed.
          </Text>
        )}
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
          <TextInput className="chat-input" placeholder="Ask anything about your sources..." value={chatText} onChange={(event) => setChatText(event.currentTarget.value)} onKeyDown={(event) => event.key === "Enter" && onChat()} />
          <ActionIcon size={36} color="teal" onClick={onChat}>
            <MessageSquareText size={17} />
          </ActionIcon>
        </Group>
      </Card>
      <Text fw={900}>AI Actions</Text>
      <div className="action-grid">
        <Button variant="light" color="teal" leftSection={<BookOpen size={16} />} onClick={() => onGenerate(["flashcards"])}>
          Flashcards
        </Button>
        <Button variant="light" color="yellow" leftSection={<Check size={16} />} onClick={() => onGenerate(["quiz"])}>
          Quiz
        </Button>
        <Button variant="light" color="blue" leftSection={<Mic size={16} />} onClick={() => onGenerate(["podcast"])}>
          Podcast
        </Button>
        <Button variant="light" color="gray" leftSection={<FileText size={16} />} onClick={() => onGenerate(["notes"])}>
          Notes
        </Button>
      </div>
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

function SettingsDrawer({ snapshot, opened, onClose, onSave }: { snapshot: AppSnapshot; opened: boolean; onClose: () => void; onSave: () => void }) {
  const [syncServerUrl, setSyncServerUrl] = useState(snapshot.settings.syncServerUrl);
  const [privacyMode, setPrivacyMode] = useState(snapshot.settings.privacyMode);

  async function save() {
    await client.updateSettings({ syncServerUrl, privacyMode });
    await onSave();
    onClose();
  }

  return (
    <Drawer opened={opened} onClose={onClose} title="Settings" position="right" size="xl">
      <Stack>
        <Switch label="Privacy mode" description="Prefer local runtimes and warn before cloud calls." checked={privacyMode} onChange={(event) => setPrivacyMode(event.currentTarget.checked)} />
        <TextInput label="Sync server URL" placeholder="http://localhost:8787" value={syncServerUrl} onChange={(event) => setSyncServerUrl(event.currentTarget.value)} />
        <TextInput label="Local database" value={snapshot.settings.dataPath} readOnly />
        <TextInput label="File storage" value={snapshot.settings.fileStoragePath} readOnly />
        <Divider label="AI providers" />
        {snapshot.settings.providers.map((provider) => (
          <Card radius={8} withBorder key={provider.id}>
            <Group justify="space-between">
              <div>
                <Text fw={800}>{provider.label}</Text>
                <Text size="xs" c="dimmed">
                  {provider.kind} · {provider.baseUrl ?? "no base URL"} · {provider.chatModel ?? "no model"}
                </Text>
              </div>
              <Badge color={provider.enabled ? "green" : "gray"}>{provider.enabled ? "enabled" : "disabled"}</Badge>
            </Group>
          </Card>
        ))}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={snapshot.analytics.masteryByTopic}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" hide />
            <YAxis />
            <ChartTooltip />
            <Bar dataKey="mastery" fill="#0f9f8f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <Button onClick={save}>Save settings</Button>
      </Stack>
    </Drawer>
  );
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

createRoot(document.getElementById("root")!).render(<App />);

export default App;
