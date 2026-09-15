import { config as loadEnv } from "dotenv";

loadEnv();

export interface MinecraftConfig {
  host: string;
  port: number;
  version: string;
  username: string;
  email: string;
  password: string;
  auth: "microsoft" | "offline";
}

export interface AIProviderSlot {
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
}

export interface AIConfig {
  primary: string;
  ravenEnabled: boolean;
  ravenBaseUrl: string;
  ravenModel: string;
  ravenApiKey: string;
  ravenTimeoutMs: number;
  allowPaidProviders: boolean;
  providers: Record<string, AIProviderSlot>;
}

export interface AutonomyConfig {
  interval: number;
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;
  reconnectMaxDelay: number;
}

export interface LoggingConfig {
  level: string;
  output: "console" | "file" | "both";
  path: string;
}

export interface ServerConfig {
  name: string;
  healthPort: number;
}

export interface XykeelConfig {
  minecraft: MinecraftConfig;
  ai: AIConfig;
  autonomy: AutonomyConfig;
  logging: LoggingConfig;
  server: ServerConfig;
  storagePath: string;
}

function env(key: string, fallback: string = ""): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

const PROVIDER_KEYS = [
  "openai", "anthropic", "gemini", "vertex", "groq", "deepseek", "xai",
  "mistral", "cohere", "together", "openrouter", "huggingface", "nvidia",
  "fireworks", "cerebras", "sambanova", "novita", "hyperbolic", "moonshot",
  "zai", "ai21", "perplexity", "deepinfra", "nebius", "lambda", "baseten",
  "friendli", "chutes", "featherless", "azure",
] as const;

function loadProviderSlots(): Record<string, AIProviderSlot> {
  const slots: Record<string, AIProviderSlot> = {};
  for (const key of PROVIDER_KEYS) {
    const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    slots[key] = {
      apiKey: env(`AI_${upperKey}_API_KEY`),
      model: env(`AI_${upperKey}_MODEL`),
      baseUrl: env(`AI_${upperKey}_BASE_URL`),
      enabled: env(`AI_${upperKey}_ENABLED`, "true") === "true",
    };
  }
  return slots;
}

export function loadConfig(overrides?: Partial<XykeelConfig>): XykeelConfig {
  const defaults: XykeelConfig = {
    minecraft: {
      host: env("MC_HOST", "localhost"),
      port: envInt("MC_PORT", 25565),
      version: env("MC_VERSION", "1.21.11"),
      username: env("MC_USERNAME", "Xykeel"),
      email: env("MC_EMAIL"),
      password: env("MC_PASSWORD"),
      auth: env("MC_AUTH", "offline") as "microsoft" | "offline",
    },
    ai: {
      primary: env("AI_PROVIDER", ""),
      ravenEnabled: envBool("AI_RAVEN_ENABLED", false),
      ravenBaseUrl: env("AI_RAVEN_BASE_URL", "http://127.0.0.1:11434/v1"),
      ravenModel: env("AI_RAVEN_MODEL"),
      ravenApiKey: env("AI_RAVEN_API_KEY"),
      ravenTimeoutMs: envInt("AI_RAVEN_TIMEOUT_MS", 30000),
      allowPaidProviders: envBool("AI_ALLOW_PAID_PROVIDERS", false),
      providers: loadProviderSlots(),
    },
    autonomy: {
      interval: envInt("AUTONOMY_INTERVAL", 30000),
      maxReconnectAttempts: envInt("MAX_RECONNECT_ATTEMPTS", 10),
      reconnectBaseDelay: envInt("RECONNECT_BASE_DELAY", 2000),
      reconnectMaxDelay: envInt("RECONNECT_MAX_DELAY", 60000),
    },
    logging: {
      level: env("LOG_LEVEL", "info"),
      output: env("LOG_OUTPUT", "both") as "console" | "file" | "both",
      path: env("LOG_PATH", "./data/logs"),
    },
    server: {
      name: env("SERVER_NAME", ""),
      healthPort: envInt("HEALTH_PORT", 3000),
    },
    storagePath: env("STORAGE_PATH", "./data"),
  };

  if (!overrides) return defaults;

  const merged = {
    ...defaults,
    ...(overrides.minecraft ? { minecraft: { ...defaults.minecraft, ...overrides.minecraft } } : {}),
    ...(overrides.ai ? { ai: { ...defaults.ai, ...overrides.ai } } : {}),
    ...(overrides.autonomy ? { autonomy: { ...defaults.autonomy, ...overrides.autonomy } } : {}),
    ...(overrides.logging ? { logging: { ...defaults.logging, ...overrides.logging } } : {}),
    ...(overrides.server ? { server: { ...defaults.server, ...overrides.server } } : {}),
    ...(overrides.storagePath !== undefined ? { storagePath: overrides.storagePath } : {}),
  } satisfies XykeelConfig;

  if (merged.minecraft.auth === "microsoft" && !merged.minecraft.email) {
    throw new Error(
      "MC_AUTH=microsoft requires MC_EMAIL. " +
      "Set MC_EMAIL to your Microsoft account email, or use MC_AUTH=offline for an independent offline-mode bot."
    );
  }
  if (merged.minecraft.auth === "offline") {
    merged.minecraft.email = "";
    merged.minecraft.password = "";
  }

  return merged;
}
