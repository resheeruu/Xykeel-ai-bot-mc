import type { XykeelLogger } from "../logging/logger.js";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type ProviderState =
  | "available"
  | "cooldown"
  | "quota_exhausted"
  | "auth_error"
  | "config_error"
  | "network_error"
  | "temporary_error"
  | "disabled";

export interface ProviderStats {
  requestCount: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  lastSuccess: number;
  lastFailure: number;
  lastError: string;
  lastErrorCategory: string;
  cooldownUntil: number;
  nextRetry: number;
  resetTimestamp: number;
}

export interface ProviderEntry {
  name: string;
  state: ProviderState;
  stats: ProviderStats;
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
}

export interface QuotaStore {
  providers: Record<string, ProviderStats>;
  savedAt: number;
}

export interface ProviderRegistry {
  register(entry: Omit<ProviderEntry, "stats">): void;
  get(name: string): ProviderEntry | undefined;
  getAvailable(): ProviderEntry[];
  getNextCandidate(): ProviderEntry | null;
  reportSuccess(name: string): void;
  reportFailure(name: string, category: string, errorMsg: string): void;
  reportRateLimit(name: string, retryAfterMs?: number): void;
  markConfigError(name: string): void;
  markDisabled(name: string): void;
  setCooldown(name: string, durationMs: number): void;
  getAll(): ProviderEntry[];
  getStats(): ProviderStats;
  persist(): void;
  restore(): void;
}

const DEFAULT_STATS = (): ProviderStats => ({
  requestCount: 0,
  successCount: 0,
  failureCount: 0,
  rateLimitCount: 0,
  lastSuccess: 0,
  lastFailure: 0,
  lastError: "",
  lastErrorCategory: "",
  cooldownUntil: 0,
  nextRetry: 0,
  resetTimestamp: 0,
});

export function createProviderRegistry(
  logger: XykeelLogger,
  persistPath: string
): ProviderRegistry {
  const providers = new Map<string, ProviderEntry>();
  let globalStats: ProviderStats = DEFAULT_STATS();

  function register(entry: Omit<ProviderEntry, "stats">): void {
    const existing = providers.get(entry.name);
    providers.set(entry.name, {
      ...entry,
      stats: existing?.stats ?? DEFAULT_STATS(),
    });
  }

  function get(name: string): ProviderEntry | undefined {
    return providers.get(name);
  }

  function getAvailable(): ProviderEntry[] {
    const now = Date.now();
    return Array.from(providers.values()).filter((p) => {
      if (!p.enabled) return false;
      if (p.state === "disabled" || p.state === "config_error") return false;
      if (p.state === "cooldown" && p.stats.cooldownUntil > now) return false;
      if (p.state === "quota_exhausted" && p.stats.resetTimestamp > now) {
        p.state = "available";
        return true;
      }
      if (p.state === "cooldown" && p.stats.cooldownUntil <= now) {
        p.state = "available";
        return true;
      }
      if (p.state === "available" || p.state === "network_error" || p.state === "temporary_error") {
        if (p.stats.nextRetry > now) return false;
        return true;
      }
      return false;
    });
  }

  function getNextCandidate(): ProviderEntry | null {
    const available = getAvailable();
    if (available.length === 0) return null;
    available.sort((a, b) => a.priority - b.priority);
    return available[0];
  }

  function reportSuccess(name: string): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.stats.requestCount++;
    entry.stats.successCount++;
    entry.stats.lastSuccess = Date.now();
    entry.stats.lastError = "";
    entry.stats.lastErrorCategory = "";
    entry.stats.nextRetry = 0;
    if (entry.state === "cooldown" || entry.state === "network_error" || entry.state === "temporary_error") {
      entry.state = "available";
    }
    globalStats.requestCount++;
    globalStats.successCount++;
    globalStats.lastSuccess = Date.now();
    logger.ai(`Provider ${name} succeeded`);
  }

  function reportFailure(name: string, category: string, errorMsg: string): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.stats.requestCount++;
    entry.stats.failureCount++;
    entry.stats.lastFailure = Date.now();
    entry.stats.lastError = redactSecrets(errorMsg);
    entry.stats.lastErrorCategory = category;
    globalStats.requestCount++;
    globalStats.failureCount++;
    globalStats.lastFailure = Date.now();
    if (category === "auth") {
      entry.state = "auth_error";
    } else if (category === "network") {
      entry.state = "network_error";
      entry.stats.nextRetry = Date.now() + 5000;
    } else {
      entry.state = "temporary_error";
      entry.stats.nextRetry = Date.now() + 10000;
    }
    logger.ai(`Provider ${name} failed: [${category}] ${redactSecrets(errorMsg)}`);
  }

  function reportRateLimit(name: string, retryAfterMs?: number): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.stats.rateLimitCount++;
    entry.stats.requestCount++;
    globalStats.rateLimitCount++;
    globalStats.requestCount++;
    const cooldownMs = retryAfterMs ?? Math.min(300_000, 30_000 * Math.pow(2, Math.min(entry.stats.rateLimitCount, 5)));
    entry.state = "cooldown";
    entry.stats.cooldownUntil = Date.now() + cooldownMs;
    entry.stats.nextRetry = entry.stats.cooldownUntil;
    logger.ai(`Provider ${name} rate-limited, cooldown ${cooldownMs}ms`);
  }

  function markConfigError(name: string): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.state = "config_error";
    entry.enabled = false;
    logger.ai(`Provider ${name} disabled: configuration error`);
  }

  function markDisabled(name: string): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.state = "disabled";
    entry.enabled = false;
  }

  function setCooldown(name: string, durationMs: number): void {
    const entry = providers.get(name);
    if (!entry) return;
    entry.state = "cooldown";
    entry.stats.cooldownUntil = Date.now() + durationMs;
    entry.stats.nextRetry = entry.stats.cooldownUntil;
  }

  function getAll(): ProviderEntry[] {
    return Array.from(providers.values());
  }

  function getStats(): ProviderStats {
    return { ...globalStats };
  }

  function persist(): void {
    try {
      const store: QuotaStore = { providers: {}, savedAt: Date.now() };
      for (const [name, entry] of providers) {
        store.providers[name] = { ...entry.stats };
      }
      mkdirSync(dirname(persistPath), { recursive: true });
      writeFileSync(persistPath, JSON.stringify(store, null, 2));
    } catch {
      // Non-fatal
    }
  }

  function restore(): void {
    try {
      if (!existsSync(persistPath)) return;
      const raw = readFileSync(persistPath, "utf-8");
      const store: QuotaStore = JSON.parse(raw);
      for (const [name, stats] of Object.entries(store.providers)) {
        const entry = providers.get(name);
        if (entry) {
          entry.stats = { ...DEFAULT_STATS(), ...stats };
          const now = Date.now();
          if (entry.stats.cooldownUntil > now) {
            entry.state = "cooldown";
          } else if (entry.stats.resetTimestamp > 0 && entry.stats.resetTimestamp > now) {
            entry.state = "quota_exhausted";
          }
        }
      }
      logger.ai("Provider quota state restored");
    } catch {
      // Non-fatal
    }
  }

  function redactSecrets(msg: string): string {
    return msg
      .replace(/sk-[a-zA-Z0-9]{10,}/g, "sk-***")
      .replace(/x-api-key[=:]\s*\S+/gi, "x-api-key: ***")
      .replace(/key[=:]\s*\S+/gi, "key=***")
      .replace(/Bearer\s+\S+/gi, "Bearer ***");
  }

  return {
    register, get, getAvailable, getNextCandidate,
    reportSuccess, reportFailure, reportRateLimit,
    markConfigError, markDisabled, setCooldown,
    getAll, getStats, persist, restore,
  };
}
