import type { Citation, Flashcard, MindMapNode, NoteSection, QuizQuestion, StudyPack } from "./types.js";
import { calculateMastery } from "./study.js";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function keywordCandidates(text: string): string[] {
  const stop = new Set(["that", "with", "from", "this", "have", "were", "their", "about", "into", "when", "where", "which", "also", "because"]);
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []) {
    if (!stop.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export function buildStudyPack(source: { id: string; title: string; text: string }): StudyPack {
  const now = new Date().toISOString();
  const sourceSentences = sentences(source.text);
  const keywords = keywordCandidates(source.text);
  const citation = (index: number): Citation => ({
    sourceId: source.id,
    label: `${source.title}, excerpt ${index + 1}`,
    excerpt: sourceSentences[index] ?? source.text.slice(0, 180)
  });

  const sections: NoteSection[] = [
    {
      id: id("section"),
      heading: "Core Summary",
      body: sourceSentences.slice(0, 3).join(" ") || "This source is ready for AI-powered study generation.",
      citations: [citation(0)]
    },
    {
      id: id("section"),
      heading: "Key Concepts",
      body: keywords.length > 0 ? keywords.map((word) => `- ${capitalize(word)}: important term from the source.`).join("\n") : "- Add more source text to extract richer concepts.",
      citations: [citation(1)]
    },
    {
      id: id("section"),
      heading: "Study Plan",
      body: "1. Read the summary.\n2. Review flashcards due today.\n3. Take the quiz in timed mode.\n4. Ask the assistant to explain weak areas.",
      citations: [citation(2)]
    }
  ];

  const flashcards: Flashcard[] = (keywords.length > 0 ? keywords.slice(0, 8) : ["summary", "source", "review"]).map((keyword, index) => ({
    id: id("card"),
    packId: "",
    front: `What should you remember about ${keyword}?`,
    back: sourceSentences[index] ?? `${capitalize(keyword)} is a key idea in ${source.title}.`,
    dueAt: now,
    intervalDays: 1,
    ease: 2.5,
    lapses: 0
  }));

  const quiz: QuizQuestion[] = flashcards.slice(0, 5).map((card, index) => ({
    id: id("quiz"),
    prompt: card.front,
    choices: [card.back, "An unrelated distractor", "A detail from a different source", "A definition with the wrong scope"],
    answerIndex: 0,
    explanation: `The correct answer is supported by ${source.title}.`,
    citations: [citation(index)]
  }));

  const mindMap: MindMapNode = {
    id: id("map"),
    label: source.title,
    children: sections.map((section) => ({
      id: id("map"),
      label: section.heading,
      children: keywords.slice(0, 3).map((keyword) => ({ id: id("map"), label: capitalize(keyword), children: [] }))
    }))
  };

  const packId = id("pack");
  const packCards = flashcards.map((card) => ({ ...card, packId }));

  return {
    id: packId,
    sourceId: source.id,
    title: `${source.title} Study Pack`,
    summary: sections[0].body,
    sections,
    flashcards: packCards,
    quiz,
    mindMap,
    podcastScript: `Welcome to your OpenTurbo audio recap for ${source.title}. We will cover ${keywords.slice(0, 5).join(", ") || "the key ideas"} and finish with a short review prompt.`,
    mastery: calculateMastery(packCards),
    createdAt: now,
    updatedAt: now
  };
}

export function answerFromSources(message: string, sources: Array<{ id: string; title: string; text: string }>): { content: string; citations: Citation[] } {
  const terms = keywordCandidates(message).slice(0, 5);
  const ranked = sources
    .map((source) => {
      const lower = source.text.toLowerCase();
      const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
      return { source, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.source ?? sources[0];
  if (!best) {
    return { content: "Add a source first, then I can answer with citations from your study library.", citations: [] };
  }

  const excerpt = sentences(best.text)[0] ?? best.text.slice(0, 220);
  return {
    content: `Based on ${best.title}, the short answer is: ${excerpt} You can turn this response into flashcards, a quiz question, or a note section from the assistant actions.`,
    citations: [{ sourceId: best.id, label: best.title, excerpt }]
  };
}

function capitalize(word: string): string {
  return word.slice(0, 1).toUpperCase() + word.slice(1);
}
