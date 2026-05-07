import { definitions, definitionFor, type ComponentName } from "./definitions.js";
import { InvalidPropsError, UnknownComponentError } from "./errors.js";

export interface A2UIPayload {
  component: string;
  props: Record<string, unknown>;
  actions?: Record<string, { actionId: string; payload?: unknown }>;
}

export interface ValidatedPayload<T = unknown> {
  componentName: ComponentName;
  props: T;
  actions: Record<string, { actionId: string; payload?: unknown }>;
}

export function validatePayload(payload: A2UIPayload): ValidatedPayload {
  const def = definitionFor(payload.component);
  if (!def) {
    throw new UnknownComponentError(payload.component);
  }
  const result = def.validateProps(payload.props);
  if (!result.ok) {
    throw new InvalidPropsError(def.name, result.error);
  }
  return {
    componentName: def.name as ComponentName,
    props: result.value,
    actions: payload.actions ?? {}
  };
}

export { definitions };
