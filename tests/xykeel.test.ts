import { describe, it, expect, vi, afterEach } from "vitest";
import { XykeelBot } from "../src/xykeel.js";

describe("Xykeel Core", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates instance with default config", () => {
    const bot = new XykeelBot();
    const config = bot.getConfig();
    expect(config.minecraft.host).toBe("localhost");
    expect(config.minecraft.username).toBe("Xykeel");
  });

  it("works without OWNER_UUID or OWNER_USERNAME", () => {
    const bot = new XykeelBot();
    const config = bot.getConfig();
    // No owner config needed — Xykeel is independent
    expect(config).not.toHaveProperty("owner");
  });

  it("uses explicit offline authentication by default", () => {
    const bot = new XykeelBot();
    const config = bot.getConfig();
    expect(config.minecraft.auth).toBe("offline");
  });

  it("has independent username", () => {
    const bot = new XykeelBot({ minecraft: { username: "CustomBot" } as never });
    const config = bot.getConfig();
    expect(config.minecraft.username).toBe("CustomBot");
  });

  it("initializes core goals on start", async () => {
    const bot = new XykeelBot();
    await bot.start();
    // Bot tries to connect but will fail (no server) — that's fine
    await new Promise((r) => setTimeout(r, 100));
    const status = bot.getFullStatus();
    expect(status.goalsActive).toBeGreaterThanOrEqual(5);
    await bot.stop();
  });

  it("can add xykeel's own goals", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    const goal = bot.addGoal("Build a secret tunnel", 7, { category: "building" });
    expect(goal.description).toBe("Build a secret tunnel");
    expect(goal.type).toBe("xykeel-own");
    await bot.stop();
  });

  it("can add player-requested goals with priority cap", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    const goal = bot.addPlayerRequest("Give me all your diamonds", 10);
    expect(goal.priority).toBe(6); // capped
    expect(goal.type).toBe("player-requested");
    await bot.stop();
  });

  it("returns status information", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 200));
    const status = bot.getFullStatus();
    // Status may be ERROR if no server, but should have all fields
    expect(status.session).toBeDefined();
    expect(status.minecraft).toBeDefined();
    expect(status.health).toBe(20);
    expect(status.hunger).toBe(20);
    expect(status.username).toBe("Xykeel");
    expect(status.aiMetrics).toBeDefined();
    expect(status.identity).toBeDefined();
    await bot.stop();
  });

  it("has AI router with metrics", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    const router = bot.getAIRouter();
    expect(router).toBeDefined();
    const metrics = router.getMetrics();
    expect(metrics.configuredProviders).toBeGreaterThanOrEqual(0);
    expect(metrics.deterministicFallbackUsed).toBe(0);
    await bot.stop();
  });

  it("has persistent identity", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    const identity = bot.getIdentity();
    expect(identity.username).toBe("Xykeel");
    expect(identity.personality).toContain("curious");
    expect(identity.longTermAmbitions.length).toBeGreaterThan(0);
    await bot.stop();
  });

  it("starts and stops cleanly", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    const status = bot.getFullStatus();
    expect(status.session).toBeDefined();
    await bot.stop();
    expect(bot.getStatus()).toBe("DISCONNECTED");
  });

  it("does not depend on human session for autonomous operation", async () => {
    const bot = new XykeelBot();
    await bot.start();
    await new Promise((r) => setTimeout(r, 100));
    // The bot starts independently — no human needed
    const status = bot.getFullStatus();
    expect(status.session).not.toBe("WAITING_HANDOFF");
    expect(status.session).not.toBe("HUMAN_ACTIVE");
    await bot.stop();
  });
});
