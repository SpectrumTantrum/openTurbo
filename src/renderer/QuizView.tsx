import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Group, Progress, Stack, Text } from "@mantine/core";
import { Check } from "lucide-react";
import { buildQuizProgress, gradeQuizQuestion, type QuizAnswerMap } from "./viewModel.js";
import type { StudyPack } from "../shared/types.js";

export function QuizView({ pack }: { pack: StudyPack }) {
  const [answers, setAnswers] = useState<QuizAnswerMap>({});

  useEffect(() => {
    setAnswers({});
  }, [pack.id]);

  const progress = useMemo(() => buildQuizProgress(pack.quiz, answers), [answers, pack.quiz]);
  const hasAnswers = progress.answered > 0;

  return (
    <Stack gap="md" p="md">
      <Card className="quiz-summary" radius={8} withBorder>
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Text fw={900}>Quiz</Text>
            <Text size="sm" c="dimmed">
              {progress.answered} of {progress.total} answered · {progress.correct} correct
            </Text>
          </div>
          <Button size="xs" variant="light" onClick={() => setAnswers({})} disabled={!hasAnswers}>
            Reset
          </Button>
        </Group>
        <Progress value={progress.percent} color="teal" mt="md" aria-label="Quiz progress" />
      </Card>

      {pack.quiz.map((question, index) => {
        const result = gradeQuizQuestion(question, answers[question.id]);

        return (
          <Card key={question.id} radius={8} withBorder>
            <Group justify="space-between" gap="sm" align="flex-start">
              <Text fw={800}>
                {index + 1}. {question.prompt}
              </Text>
              {result.isAnswered && (
                <Badge color={result.isCorrect ? "teal" : "red"} variant="light">
                  {result.isCorrect ? "Correct" : "Review"}
                </Badge>
              )}
            </Group>
            <Stack gap={6} mt="sm">
              {question.choices.map((choice, choiceIndex) => {
                const isSelected = result.selectedIndex === choiceIndex;
                const isCorrectChoice = result.isAnswered && choiceIndex === question.answerIndex;
                const isIncorrectSelection = result.isAnswered && isSelected && !result.isCorrect;
                const className = ["choice", isSelected ? "selected" : "", isCorrectChoice ? "correct" : "", isIncorrectSelection ? "incorrect" : ""].filter(Boolean).join(" ");

                return (
                  <button key={`${question.id}-${choiceIndex}`} className={className} type="button" aria-pressed={isSelected} onClick={() => setAnswers((current) => ({ ...current, [question.id]: choiceIndex }))}>
                    <span>{choice}</span>
                    {isCorrectChoice && <Check size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </Stack>
            {result.isAnswered && (
              <Text size="sm" c="dimmed" mt="sm">
                {question.explanation}
              </Text>
            )}
          </Card>
        );
      })}
      {pack.quiz.length === 0 && (
        <Card radius={8} withBorder>
          <Text fw={800}>No quiz items yet</Text>
        </Card>
      )}
    </Stack>
  );
}
