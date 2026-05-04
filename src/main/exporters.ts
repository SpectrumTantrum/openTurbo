import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StudyPack } from "../shared/types.js";

export type ExportFormat = "markdown" | "json" | "anki-csv";

export function exportStudyPack(pack: StudyPack, format: ExportFormat, exportDir: string): string {
  mkdirSync(exportDir, { recursive: true });
  const safeTitle = pack.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "study-pack";

  if (format === "json") {
    const outputPath = join(exportDir, `${safeTitle}.json`);
    writeFileSync(outputPath, JSON.stringify(pack, null, 2));
    return outputPath;
  }

  if (format === "anki-csv") {
    const outputPath = join(exportDir, `${safeTitle}-anki.csv`);
    const rows = pack.flashcards.map((card) => `"${escapeCsv(card.front)}","${escapeCsv(card.back)}"`);
    writeFileSync(outputPath, ["Front,Back", ...rows].join("\n"));
    return outputPath;
  }

  const outputPath = join(exportDir, `${safeTitle}.md`);
  const noteSections = pack.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n");
  const cards = pack.flashcards.map((card) => `- **${card.front}** ${card.back}`).join("\n");
  const quiz = pack.quiz.map((question) => `- ${question.prompt}\n  - Answer: ${question.choices[question.answerIndex]}\n  - Why: ${question.explanation}`).join("\n");
  writeFileSync(
    outputPath,
    `# ${pack.title}\n\n${pack.summary}\n\n${noteSections}\n\n## Flashcards\n\n${cards}\n\n## Quiz\n\n${quiz}\n\n## Podcast Script\n\n${pack.podcastScript}\n`
  );
  return outputPath;
}

function escapeCsv(value: string): string {
  return value.replace(/"/g, '""').replace(/\r?\n/g, "\\n");
}
