import { describe, it, expect } from "vitest";
import { XykeelBot } from "../src/xykeel.js";

describe("Xykeel Core", () => {
  it("creates instance with default config", () => {
    const bot = new XykeelBot();
    const config = bot.getConfig();
    expect(config.minecraft.host).toBe("localhost");
    expect(config.ai.provider).toBe("local");
  });

  it("initializes core goals on start", async () => {
    const bot = new XykeelBot();
    await bot.start();
    const status = bot.getFullStatus();
    expect(status.goalsActive).toBeGreaterThanOrEqual(5);
    await bot.stop();
  });

  it("can add xykeel's own goals", async () => {
    const bot = new XykeelBot();
    await bot.start();
    const goal = bot.addGoal("Build a secret tunnel", 7, { category: "building" });
    expect(goal.description).toBe("Build a secret tunnel");
    expect(goal.type).toBe("xykeel-own");
    await bot.stop();
  });

  it("can add player-requested goals with priority cap", async () => {
    const bot = new XykeelBot();
    await bot.start();
    const goal = bot.addPlayerRequest("Give me all your diamonds", 10);
    expect(goal.priority).toBe(6); // capped
    expect(goal.type).toBe("player-requested");
    await bot.stop();
  });

  it("returns status information", async () => {
    const bot = new XykeelBot();
    await bot.start();
    const status = bot.getFullStatus();
    expect(status.session).toBe("DISCONNECTED");
    expect(status.minecraft).toBe("DISCONNECTED");
    expect(status.health).toBe(20);
    expect(status.hunger).toBe(20);
    await bot.stop();
  });

  it("starts and stops cleanly", async () => {
    const bot = new XykeelBot();
    await bot.start();
    // Status is DISCONNECTED before connecting to a server, but the bot is running
    const status = bot.getFullStatus();
    expect(status.session).toBeDefined();
    await bot.stop();
    expect(bot.getStatus()).toBe("DISCONNECTED");
  });
});
