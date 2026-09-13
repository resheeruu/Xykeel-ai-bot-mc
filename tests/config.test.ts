import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config/config.js";

describe("Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads with defaults when no env vars set", () => {
    const config = loadConfig();
    expect(config.minecraft.host).toBe("localhost");
    expect(config.minecraft.port).toBe(25565);
    expect(config.minecraft.version).toBe("1.21.1");
    expect(config.minecraft.username).toBe("Xykeel");
    expect(config.minecraft.auth).toBe("offline");
    expect(config.ai.provider).toBe("local");
    expect(config.autonomy.interval).toBe(30000);
    expect(config.autonomy.handoffDelay).toBe(30000);
    expect(config.logging.level).toBe("info");
  });

  it("reads environment variables", () => {
    process.env.MC_HOST = "play.example.com";
    process.env.MC_PORT = "19132";
    process.env.MC_VERSION = "1.20.4";
    process.env.AI_PROVIDER = "ollama";

    const config = loadConfig();
    expect(config.minecraft.host).toBe("play.example.com");
    expect(config.minecraft.port).toBe(19132);
    expect(config.minecraft.version).toBe("1.20.4");
    expect(config.ai.provider).toBe("ollama");
  });

  it("applies overrides", () => {
    const config = loadConfig({
      minecraft: { host: "override.test", port: 9999, version: "1.19", username: "Test", email: "", password: "", auth: "offline" },
    });
    expect(config.minecraft.host).toBe("override.test");
    expect(config.minecraft.port).toBe(9999);
  });

  it("does not require AI API key for local provider", () => {
    const config = loadConfig();
    expect(config.ai.provider).toBe("local");
    expect(config.ai.apiKey).toBe("");
  });
});
