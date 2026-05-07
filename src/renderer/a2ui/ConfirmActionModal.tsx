import { Button, Group, Modal, Text } from "@mantine/core";

export interface ConfirmActionModalProps {
  opened: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  opened,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmActionModalProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title={title} centered radius={8}>
      <Text size="sm">{message}</Text>
      <Group justify="flex-end" mt="md" gap={6}>
        <Button variant="subtle" onClick={onCancel}>Cancel</Button>
        <Button color="teal" onClick={onConfirm}>{confirmLabel}</Button>
      </Group>
    </Modal>
  );
}
