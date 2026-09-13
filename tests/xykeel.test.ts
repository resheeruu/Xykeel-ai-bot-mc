import { describe, it, expect } from "vitest";
import { Xykeel } from "../src/index.js";

describe("Xykeel Core", () => {
  it("creates instance with default config", () => {
    const bot = new Xykeel();
    const config = bot.getConfig();
    expect(config.minecraft.host).toBe("localhost");
    expect(config.ai.provider).toBe("local");
  });

  it("initializes core goals on start", async () => {
    const bot = new Xykeel();
    await bot.start();
    const state = bot.getState();
    expect(state.goals.length).toBeGreaterThanOrEqual(5);
    await bot.stop();
  });

  it("can add xykeel's own goals", async () => {
    const bot = new Xykeel();
    await bot.start();
    const goal = bot.addGoal("Build a secret tunnel", 7, { category: "building" });
    expect(goal.description).toBe("Build a secret tunnel");
    expect(goal.type).toBe("xykeel-own");
    await bot.stop();
  });

  it("can add player-requested goals with priority cap", async () => {
    const bot = new Xykeel();
    await bot.start();
    const goal = bot.addPlayerRequest("Give me all your diamonds", 10);
    expect(goal.priority).toBe(6); // capped
    expect(goal.type).toBe("player-requested");
    await bot.stop();
  });

  it("handles chat messages", async () => {
    const bot = new Xykeel();
    await bot.start();
    const response = bot.handleChat("Alice", "Hello Xykeel!");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
    await bot.stop();
  });

  it("starts and stops cleanly", async () => {
    const bot = new Xykeel();
    await bot.start();
    expect(bot.getState().running).toBe(true);
    await bot.stop();
    expect(bot.getState().running).toBe(false);
  });
});
