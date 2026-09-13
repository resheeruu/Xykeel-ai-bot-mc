import { describe, it, expect } from "vitest";
import { createAIProvider, LocalAIProvider } from "../src/ai/provider.js";

describe("AI Provider", () => {
  it("creates local provider", () => {
    const provider = createAIProvider({ provider: "local" });
    expect(provider).toBeInstanceOf(LocalAIProvider);
    expect(provider.name).toBe("local");
  });

  it("local provider initializes and is available", async () => {
    const provider = new LocalAIProvider();
    expect(provider.isAvailable()).toBe(false);
    await provider.initialize();
    expect(provider.isAvailable()).toBe(true);
  });

  it("local provider returns deterministic decisions", async () => {
    const provider = new LocalAIProvider();
    await provider.initialize();

    const hungerResponse = await provider.chat("I am hungry, need food");
    expect(hungerResponse).toContain("Eat");

    const dangerResponse = await provider.chat("There is a hostile mob nearby");
    expect(dangerResponse).toContain("Retreat");

    const miningResponse = await provider.chat("I need to mine iron ore");
    expect(miningResponse).toContain("mining");

    const buildResponse = await provider.chat("I want to build a workshop");
    expect(buildResponse).toContain("materials");
  });

  it("local provider shuts down cleanly", async () => {
    const provider = new LocalAIProvider();
    await provider.initialize();
    await provider.shutdown();
    expect(provider.isAvailable()).toBe(false);
  });

  it("creates provider for any type (falls back to local)", async () => {
    for (const type of ["local", "openai", "ollama"] as const) {
      const provider = createAIProvider({ provider: type });
      await provider.initialize();
      expect(provider.isAvailable()).toBe(true);
    }
  });
});
