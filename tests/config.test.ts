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
    expect(config.ai.ravenEnabled).toBe(false);
    expect(config.autonomy.interval).toBe(30000);
    expect(config.logging.level).toBe("info");
  });

  it("reads environment variables", () => {
    process.env.MC_HOST = "play.example.com";
    process.env.MC_PORT = "19132";
    process.env.MC_VERSION = "1.20.4";
    process.env.MC_USERNAME = "TestBot";

    const config = loadConfig();
    expect(config.minecraft.host).toBe("play.example.com");
    expect(config.minecraft.port).toBe(19132);
    expect(config.minecraft.version).toBe("1.20.4");
    expect(config.minecraft.username).toBe("TestBot");
  });

  it("applies overrides", () => {
    const config = loadConfig({
      minecraft: { host: "override.test", port: 9999, version: "1.19", username: "Test", email: "", password: "", auth: "offline" },
    });
    expect(config.minecraft.host).toBe("override.test");
    expect(config.minecraft.port).toBe(9999);
  });

  it("loads AI provider slots from env", () => {
    process.env.AI_GROQ_API_KEY = "test-key";
    process.env.AI_GROQ_MODEL = "llama-3.1-8b-instant";
    const config = loadConfig();
    expect(config.ai.providers.groq.apiKey).toBe("test-key");
    expect(config.ai.providers.groq.model).toBe("llama-3.1-8b-instant");
  });

  it("disabled providers without API keys are config_error", () => {
    const config = loadConfig();
    // Providers without API keys should have empty keys
    expect(config.ai.providers.openai.apiKey).toBe("");
  });

  it("microsoft auth without email throws configuration error", () => {
    expect(() => loadConfig({
      minecraft: { host: "test", port: 25565, version: "1.21.1", username: "X", email: "", password: "", auth: "microsoft" },
    })).toThrow("MC_AUTH=microsoft requires MC_EMAIL");
  });

  it("offline auth clears credentials", () => {
    const config = loadConfig({
      minecraft: { host: "test", port: 25565, version: "1.21.1", username: "X", email: "user@test.com", password: "secret", auth: "offline" },
    });
    expect(config.minecraft.email).toBe("");
    expect(config.minecraft.password).toBe("");
  });

  it("microsoft auth keeps email when provided", () => {
    const config = loadConfig({
      minecraft: { host: "test", port: 25565, version: "1.21.1", username: "X", email: "user@test.com", password: "", auth: "microsoft" },
    });
    expect(config.minecraft.auth).toBe("microsoft");
    expect(config.minecraft.email).toBe("user@test.com");
  });

  it("paid providers disabled by default", () => {
    const config = loadConfig();
    expect(config.ai.allowPaidProviders).toBe(false);
  });

  it("raven config loads from env", () => {
    process.env.AI_RAVEN_ENABLED = "true";
    process.env.AI_RAVEN_BASE_URL = "http://localhost:8080/v1";
    process.env.AI_RAVEN_MODEL = "my-model";
    const config = loadConfig();
    expect(config.ai.ravenEnabled).toBe(true);
    expect(config.ai.ravenBaseUrl).toBe("http://localhost:8080/v1");
    expect(config.ai.ravenModel).toBe("my-model");
  });

  it("no owner config required", () => {
    const config = loadConfig();
    // OwnerConfig no longer exists - Xykeel is independent
    expect(config).not.toHaveProperty("owner");
  });

  it("microsoft auth with email succeeds", () => {
    const config = loadConfig({
      minecraft: { host: "test", port: 25565, version: "1.21.1", username: "X", email: "user@test.com", password: "", auth: "microsoft" },
    });
    expect(config.minecraft.auth).toBe("microsoft");
    expect(config.minecraft.email).toBe("user@test.com");
  });

  it("offline auth never requires email", () => {
    const config = loadConfig({
      minecraft: { host: "test", port: 25565, version: "1.21.1", username: "Xykeel", email: "", password: "", auth: "offline" },
    });
    expect(config.minecraft.auth).toBe("offline");
    expect(config.minecraft.email).toBe("");
  });

  it("all 30 provider slots exist in config", () => {
    const config = loadConfig();
    const providers = Object.keys(config.ai.providers);
    expect(providers.length).toBe(30);
    expect(providers).toContain("openai");
    expect(providers).toContain("anthropic");
    expect(providers).toContain("gemini");
    expect(providers).toContain("groq");
    expect(providers).toContain("azure");
  });

  it("providers without API keys have empty apiKey", () => {
    const config = loadConfig();
    expect(config.ai.providers.groq.apiKey).toBe("");
    expect(config.ai.providers.openai.apiKey).toBe("");
    expect(config.ai.providers.anthropic.apiKey).toBe("");
  });

  it("allowPaidProviders defaults to false", () => {
    const config = loadConfig();
    expect(config.ai.allowPaidProviders).toBe(false);
  });

  it("raven defaults to disabled", () => {
    const config = loadConfig();
    expect(config.ai.ravenEnabled).toBe(false);
    expect(config.ai.ravenModel).toBe("");
  });
});
