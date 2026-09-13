export interface AIProvider {
  readonly name: string;
  initialize(): Promise<void>;
  chat(prompt: string, context?: string): Promise<string>;
  isAvailable(): boolean | Promise<boolean>;
  shutdown(): Promise<void>;
}

export interface AIProviderConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class LocalAIProvider implements AIProvider {
  readonly name = "local";
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = true;
  }

  async chat(prompt: string, _context?: string): Promise<string> {
    return this.fallbackDecision(prompt);
  }

  isAvailable(): boolean {
    return this.ready;
  }

  async shutdown(): Promise<void> {
    this.ready = false;
  }

  private fallbackDecision(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes("eat") || lower.includes("food") || lower.includes("hunger")) {
      return "ACTION: Eat available food immediately.";
    }
    if (lower.includes("danger") || lower.includes("hostile") || lower.includes("attack")) {
      return "ACTION: Retreat to safe location.";
    }
    if (lower.includes("mine") || lower.includes("resource")) {
      return "ACTION: Proceed with mining if equipment is adequate.";
    }
    if (lower.includes("build") || lower.includes("construct")) {
      return "ACTION: Gather materials and begin construction.";
    }
    if (lower.includes("farm") || lower.includes("crop")) {
      return "ACTION: Tend to existing crops or establish farm.";
    }
    if (lower.includes("explore") || lower.includes("scout")) {
      return "ACTION: Explore the surrounding area cautiously.";
    }
    if (lower.includes("shop") || lower.includes("business") || lower.includes("trade")) {
      return "ACTION: Check inventory and evaluate trading opportunities.";
    }
    return "ACTION: Idle — assess needs and choose highest-priority goal.";
  }
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "local":
      return new LocalAIProvider();
    default:
      return new LocalAIProvider();
  }
}
