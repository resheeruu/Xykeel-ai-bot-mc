import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProviderRegistry, type ProviderRegistry } from "../src/ai/provider-registry.js";
import { createMultiProviderRouter } from "../src/ai/multi-router.js";
import { LocalAIProvider } from "../src/ai/provider.js";
import { buildContext, summarizeInventory, type BotContextForAI } from "../src/ai/context-builder.js";
import { createLogger } from "../src/logging/logger.js";
import { loadConfig } from "../src/config/config.js";
import { existsSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

function tmpPath(): string {
  return `data/.test-tmp-xykeel-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
}

describe("Provider Registry", () => {
  let registry: ProviderRegistry;
  const persistPath = tmpPath();

  beforeEach(() => {
    registry = createProviderRegistry(logger, persistPath);
  });

  it("creates empty registry", () => {
    expect(registry.getAll()).toEqual([]);
    expect(registry.getAvailable()).toEqual([]);
    expect(registry.getNextCandidate()).toBeNull();
  });

  it("registers providers", () => {
    registry.register({
      name: "test-provider",
      state: "available",
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://api.test.com/v1",
      enabled: true,
      priority: 1,
    });
    expect(registry.get("test-provider")).toBeDefined();
    expect(registry.get("test-provider")?.name).toBe("test-provider");
  });

  it("reports success", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.reportSuccess("p1");
    const entry = registry.get("p1");
    expect(entry?.stats.successCount).toBe(1);
    expect(entry?.stats.lastSuccess).toBeGreaterThan(0);
  });

  it("reports failure with category", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.reportFailure("p1", "network", "Connection refused");
    const entry = registry.get("p1");
    expect(entry?.stats.failureCount).toBe(1);
    expect(entry?.stats.lastErrorCategory).toBe("network");
    expect(entry?.state).toBe("network_error");
  });

  it("reports rate limit with cooldown", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.reportRateLimit("p1", 5000);
    const entry = registry.get("p1");
    expect(entry?.state).toBe("cooldown");
    expect(entry?.stats.rateLimitCount).toBe(1);
  });

  it("marks config error disables provider", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.markConfigError("p1");
    const entry = registry.get("p1");
    expect(entry?.state).toBe("config_error");
    expect(entry?.enabled).toBe(false);
  });

  it("getAvailable excludes disabled and config_error", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.register({
      name: "p2", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: false, priority: 2,
    });
    registry.register({
      name: "p3", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 3,
    });
    registry.markConfigError("p3");

    const available = registry.getAvailable();
    expect(available.length).toBe(1);
    expect(available[0].name).toBe("p1");
  });

  it("getNextCandidate returns highest priority available", () => {
    registry.register({
      name: "low-pri", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 10,
    });
    registry.register({
      name: "high-pri", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    const candidate = registry.getNextCandidate();
    expect(candidate?.name).toBe("high-pri");
  });

  it("redacts secrets from error messages", () => {
    registry.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    registry.reportFailure("p1", "auth", "Error with sk-abc123def456ghijk token");
    const entry = registry.get("p1");
    expect(entry?.stats.lastError).not.toContain("sk-abc123def456ghijk");
    expect(entry?.stats.lastError).toContain("sk-***");
  });

  it("persists and restores quota state", () => {
    const path = `data/.test-tmp-reg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const reg1 = createProviderRegistry(logger, path);
    reg1.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    reg1.reportSuccess("p1");
    reg1.reportSuccess("p1");
    reg1.persist();

    // Verify the file was written
    expect(existsSync(path)).toBe(true);
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    expect(raw.providers.p1.successCount).toBe(2);

    const reg2 = createProviderRegistry(logger, path);
    reg2.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    reg2.restore();
    expect(reg2.get("p1")?.stats.successCount).toBe(2);
  });
});

describe("Multi-Provider Router", () => {
  it("creates router with local fallback", () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    const router = createMultiProviderRouter(config, logger, fallback);
    expect(router.name).toBe("multi-provider-router");
  });

  it("initializes without errors", async () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    const metrics = router.getMetrics();
    expect(metrics.configuredProviders).toBe(0);
    expect(metrics.availableProviders).toBe(0);
  });

  it("falls back to deterministic provider when no API keys", async () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    await fallback.initialize();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    const result = await router.chat("What should I eat?");
    expect(result).toContain("ACTION");
    expect(router.getMetrics().deterministicFallbackUsed).toBe(1);
  });

  it("reports metrics correctly", async () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    await fallback.initialize();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    await router.chat("test prompt");
    const metrics = router.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.currentProvider).toBe("deterministic");
  });

  it("shutdown persists provider state", async () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    await router.shutdown();
    // Should not throw
  });

  it("skips providers without API keys", async () => {
    const config = loadConfig();
    const fallback = new LocalAIProvider();
    await fallback.initialize();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    const registry = router.getRegistry();
    // No providers should be registered (no API keys in test env)
    expect(registry.getAll().length).toBe(0);
  });

  it("paid providers disabled by default", async () => {
    process.env.AI_OPENAI_API_KEY = "test-key";
    const config = loadConfig();
    delete process.env.AI_OPENAI_API_KEY;
    const fallback = new LocalAIProvider();
    const router = createMultiProviderRouter(config, logger, fallback);
    await router.initialize();
    const registry = router.getRegistry();
    const openai = registry.get("openai");
    // OpenAI is a paid provider, should be disabled when allowPaidProviders=false
    expect(openai?.enabled).toBe(false);
  });
});

describe("Identity System", () => {
  it("creates default identity profile", async () => {
    const { createIdentitySystem } = await import("../src/identity/profile.js");
    const identity = createIdentitySystem(logger);
    const { createStore } = await import("../src/memory/store.js");
    const store = createStore();
    const profile = identity.getProfile(store);
    expect(profile.username).toBe("Xykeel");
    expect(profile.personality).toContain("curious");
    expect(profile.longTermAmbitions.length).toBeGreaterThan(0);
  });

  it("updates identity profile", async () => {
    const { createIdentitySystem } = await import("../src/identity/profile.js");
    const identity = createIdentitySystem(logger);
    let { createStore } = await import("../src/memory/store.js");
    let store = createStore();
    store = identity.updateProfile(store, { username: "CustomName" });
    const profile = identity.getProfile(store);
    expect(profile.username).toBe("CustomName");
  });

  it("adds life history entries", async () => {
    const { createIdentitySystem } = await import("../src/identity/profile.js");
    const identity = createIdentitySystem(logger);
    let { createStore } = await import("../src/memory/store.js");
    let store = createStore();
    store = identity.addLifeHistory(store, "Established first home");
    store = identity.addLifeHistory(store, "Mined 20 iron ore");
    const profile = identity.getProfile(store);
    expect(profile.lifeHistory.length).toBe(2);
    expect(profile.lifeHistory[0]).toBe("Established first home");
  });

  it("adds world discoveries", async () => {
    const { createIdentitySystem } = await import("../src/identity/profile.js");
    const identity = createIdentitySystem(logger);
    let { createStore } = await import("../src/memory/store.js");
    let store = createStore();
    store = identity.addDiscovery(store, "Found a village to the north");
    const profile = identity.getProfile(store);
    expect(profile.worldDiscoveries.length).toBe(1);
  });

  it("persists identity across store reloads", async () => {
    const { createIdentitySystem } = await import("../src/identity/profile.js");
    const { createStore, saveStore, loadStore } = await import("../src/memory/store.js");
    const identity = createIdentitySystem(logger);
    let store = createStore();
    store = identity.updateProfile(store, { username: "PersistedName" });
    const path = `${process.cwd()}/data/test-identity-${Date.now()}.json`;
    saveStore(store, path);
    const loaded = loadStore(path);
    const profile = identity.getProfile(loaded);
    expect(profile.username).toBe("PersistedName");
    // Cleanup
    try { require("node:fs").unlinkSync(path); } catch { /* ignore */ }
  });
});

describe("Context Builder", () => {
  const baseCtx: BotContextForAI = {
    username: "Xykeel",
    health: 20,
    hunger: 20,
    position: { x: 100, y: 64, z: -200 },
    biome: "plains",
    isDaytime: true,
    currentGoal: null,
    currentPlan: null,
    currentActivity: "Idle",
    inventorySummary: "wood: 32, stone: 16",
    nearbyPlayers: [],
    dangerLevel: "safe",
    recentEvents: [],
    identity: null,
  };

  it("builds basic context string", () => {
    const ctx = buildContext(baseCtx);
    expect(ctx).toContain("Xykeel");
    expect(ctx).toContain("HP: 20/20");
    expect(ctx).toContain("Food: 20/20");
    expect(ctx).toContain("plains");
    expect(ctx).toContain("day");
    expect(ctx).toContain("wood: 32");
  });

  it("includes danger level when not safe", () => {
    const ctx = buildContext({ ...baseCtx, dangerLevel: "danger" });
    expect(ctx).toContain("DANGER");
  });

  it("omits danger level when safe", () => {
    const ctx = buildContext({ ...baseCtx, dangerLevel: "safe" });
    expect(ctx).not.toContain("DANGER");
  });

  it("truncates context exceeding max length", () => {
    const longEvents = Array.from({ length: 100 }, (_, i) => `Event ${i}: ${"x".repeat(50)}`);
    const ctx = buildContext({ ...baseCtx, recentEvents: longEvents });
    expect(ctx.length).toBeLessThanOrEqual(2000);
  });

  it("includes identity personality and interests", () => {
    const identity = {
      username: "Xykeel",
      personality: ["curious", "bold"],
      preferences: [],
      interests: ["mining", "building"],
      dislikes: [],
      longTermAmbitions: [],
      currentProjects: ["Build a tower"],
      lifeHistory: [],
      businessPreferences: [],
      home: null,
      importantLocations: [],
      worldDiscoveries: [],
    };
    const ctx = buildContext({ ...baseCtx, identity });
    expect(ctx).toContain("curious");
    expect(ctx).toContain("mining");
    expect(ctx).toContain("Build a tower");
  });

  it("summarizes empty inventory", () => {
    expect(summarizeInventory([])).toBe("empty");
  });

  it("summarizes inventory by category", () => {
    const items = [
      { name: "iron_pickaxe", count: 1 },
      { name: "oak_log", count: 16 },
      { name: "stone", count: 32 },
      { name: "bread", count: 5 },
    ];
    const summary = summarizeInventory(items);
    expect(summary).toContain("pickaxes: 1");
    expect(summary).toContain("wood: 16");
    expect(summary).toContain("stone: 32");
    expect(summary).toContain("food: 5");
  });
});

describe("Provider Registry Edge Cases", () => {
  it("rate limit cooldown blocks provider until expiry", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    reg.reportRateLimit("p1", 60000);
    const entry = reg.get("p1");
    expect(entry?.state).toBe("cooldown");
    expect(entry?.stats.cooldownUntil).toBeGreaterThan(Date.now());
    expect(reg.getAvailable()).toEqual([]);
  });

  it("auth error permanently disables provider", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    reg.reportFailure("p1", "auth", "401 Unauthorized");
    const entry = reg.get("p1");
    expect(entry?.state).toBe("auth_error");
    expect(reg.getAvailable()).toEqual([]);
  });

  it("reporting success on a cooldown provider moves it to available", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({
      name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1,
    });
    reg.setCooldown("p1", 60000);
    reg.reportSuccess("p1");
    const entry = reg.get("p1");
    expect(entry?.state).toBe("available");
  });

  it("priority ordering picks the right candidate", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({ name: "slow", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 5 });
    reg.register({ name: "fast", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1 });
    reg.register({ name: "medium", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 3 });
    const candidate = reg.getNextCandidate();
    expect(candidate?.name).toBe("fast");
  });

  it("redacts Bearer tokens from error messages", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({ name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1 });
    reg.reportFailure("p1", "auth", "Authorization: Bearer secret-token-xyz");
    const entry = reg.get("p1");
    expect(entry?.stats.lastError).not.toContain("secret-token-xyz");
    expect(entry?.stats.lastError).toContain("Bearer ***");
  });

  it("redacts x-api-key headers from error messages", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({ name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1 });
    reg.reportFailure("p1", "auth", "x-api-key: my-secret-key-12345");
    const entry = reg.get("p1");
    expect(entry?.stats.lastError).not.toContain("my-secret-key-12345");
    expect(entry?.stats.lastError).toContain("x-api-key");
  });

  it("getStats aggregates global counts", () => {
    const reg = createProviderRegistry(logger, tmpPath());
    reg.register({ name: "p1", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 1 });
    reg.register({ name: "p2", state: "available", apiKey: "k", model: "m", baseUrl: "u", enabled: true, priority: 2 });
    reg.reportSuccess("p1");
    reg.reportSuccess("p2");
    reg.reportFailure("p2", "network", "timeout");
    const stats = reg.getStats();
    expect(stats.requestCount).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failureCount).toBe(1);
  });
});

describe("Malformed Response Handling", () => {
  it("LocalAIProvider always returns valid ACTION string", async () => {
    const provider = new LocalAIProvider();
    await provider.initialize();
    const result = await provider.chat("any random gibberish xyz 123");
    expect(result).toMatch(/^ACTION:/);
  });

  it("LocalAIProvider handles empty prompt", async () => {
    const provider = new LocalAIProvider();
    await provider.initialize();
    const result = await provider.chat("");
    expect(result).toMatch(/^ACTION:/);
  });

  it("deterministic fallback is always available after init", async () => {
    const provider = new LocalAIProvider();
    await provider.initialize();
    expect(provider.isAvailable()).toBe(true);
  });
});
