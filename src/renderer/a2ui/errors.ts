export class UnknownComponentError extends Error {
  componentName: string;
  constructor(componentName: string) {
    super(`Unknown A2UI component: ${componentName}`);
    this.name = "UnknownComponentError";
    this.componentName = componentName;
  }
}

export class InvalidPropsError extends Error {
  componentName: string;
  detail: string;
  constructor(componentName: string, detail: string) {
    super(`Invalid props for ${componentName}: ${detail}`);
    this.name = "InvalidPropsError";
    this.componentName = componentName;
    this.detail = detail;
  }
}

export class BlockedActionError extends Error {
  actionId: string;
  reason: string;
  constructor(actionId: string, reason: string) {
    super(`Blocked action ${actionId}: ${reason}`);
    this.name = "BlockedActionError";
    this.actionId = actionId;
    this.reason = reason;
  }
}

export interface RendererFailureDescription {
  headline: string;
  detail?: string;
}

export function describeRendererFailure(error: unknown, options: { dev: boolean }): RendererFailureDescription {
  if (error instanceof UnknownComponentError) {
    return {
      headline: "Unsupported component requested",
      detail: options.dev ? `Unknown component name "${error.componentName}".` : undefined
    };
  }
  if (error instanceof InvalidPropsError) {
    return {
      headline: "Couldn't render this card",
      detail: options.dev ? `${error.componentName}: ${error.detail}` : undefined
    };
  }
  if (error instanceof BlockedActionError) {
    return {
      headline: "Action blocked for safety",
      detail: options.dev ? `${error.actionId}: ${error.reason}` : undefined
    };
  }
  return { headline: "Couldn't render this card" };
}
