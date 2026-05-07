import { ActionIcon, Group, TextInput } from "@mantine/core";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";

export interface AssistantPromptProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  disabled: boolean;
}

export function AssistantPrompt({ placeholder, onSubmit, disabled }: AssistantPromptProps) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };
  return (
    <Group gap={6} align="center" wrap="nowrap" className="assistant-prompt">
      <TextInput
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        style={{ flex: 1 }}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
      />
      <ActionIcon
        size={36}
        color="teal"
        onClick={submit}
        disabled={disabled}
        aria-label="Send to assistant"
      >
        <MessageSquareText size={18} />
      </ActionIcon>
    </Group>
  );
}
