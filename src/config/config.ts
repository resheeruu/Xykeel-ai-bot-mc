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

export interface AIConfig {
  provider: "local" | "openai" | "ollama";
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface AutonomyConfig {
  interval: number;
  handoffDelay: number;
  maxReconnectAttempts: number;
}

export interface LoggingConfig {
  level: string;
  output: "console" | "file" | "both";
  path: string;
}

export interface OwnerConfig {
  uuid: string;
  username: string;
}

export interface ServerConfig {
  name: string;
}

export interface XykeelConfig {
  minecraft: MinecraftConfig;
  ai: AIConfig;
  autonomy: AutonomyConfig;
  logging: LoggingConfig;
  owner: OwnerConfig;
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

export function loadConfig(overrides?: Partial<XykeelConfig>): XykeelConfig {
  const defaults: XykeelConfig = {
    minecraft: {
      host: env("MC_HOST", "localhost"),
      port: envInt("MC_PORT", 25565),
      version: env("MC_VERSION", "1.21.1"),
      username: env("MC_USERNAME", "Xykeel"),
      email: env("MC_EMAIL"),
      password: env("MC_PASSWORD"),
      auth: env("MC_AUTH", "offline") as "microsoft" | "offline",
    },
    ai: {
      provider: env("AI_PROVIDER", "local") as "local" | "openai" | "ollama",
      apiKey: env("AI_API_KEY"),
      model: env("AI_MODEL"),
      baseUrl: env("AI_BASE_URL"),
    },
    autonomy: {
      interval: envInt("AUTONOMY_INTERVAL", 30000),
      handoffDelay: envInt("HANDOFF_DELAY", 30000),
      maxReconnectAttempts: envInt("MAX_RECONNECT_ATTEMPTS", 5),
    },
    logging: {
      level: env("LOG_LEVEL", "info"),
      output: env("LOG_OUTPUT", "both") as "console" | "file" | "both",
      path: env("LOG_PATH", "./data/logs"),
    },
    owner: {
      uuid: env("OWNER_UUID"),
      username: env("OWNER_USERNAME"),
    },
    server: {
      name: env("SERVER_NAME", "lunamoon"),
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
    ...(overrides.owner ? { owner: { ...defaults.owner, ...overrides.owner } } : {}),
    ...(overrides.server ? { server: { ...defaults.server, ...overrides.server } } : {}),
    ...(overrides.storagePath !== undefined ? { storagePath: overrides.storagePath } : {}),
  } satisfies XykeelConfig;
  return merged;
}
