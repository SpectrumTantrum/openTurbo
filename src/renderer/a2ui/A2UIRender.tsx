import { validatePayload, type A2UIPayload } from "./catalog.js";
import { renderForName } from "./renderers.js";
import { SafeErrorCard } from "./SafeErrorCard.js";

export interface A2UIRenderHandlers {
  onAction: (actionId: string, args?: unknown) => void;
}

export interface A2UIRenderProps {
  payload: A2UIPayload;
  handlers: A2UIRenderHandlers;
  dev?: boolean;
}

export function A2UIRender({ payload, handlers, dev = false }: A2UIRenderProps) {
  let validated;
  try {
    validated = validatePayload(payload);
  } catch (error) {
    return <SafeErrorCard error={error} dev={dev} />;
  }
  const ctx = {
    emit: (actionId: string, args?: unknown) => handlers.onAction(actionId, args),
    getActionId: (name: string) => validated.actions[name]?.actionId
  };
  try {
    return renderForName(validated.componentName, validated.props, ctx);
  } catch (error) {
    return <SafeErrorCard error={error} dev={dev} />;
  }
}
