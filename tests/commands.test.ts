import { describe, it, expect } from "vitest";
import { createCommandRegistry, createServerCommand } from "../src/commands/registry.js";
import { createStore, remember, type MemoryStore } from "../src/memory/store.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

function emptyStore(): MemoryStore {
  return createStore();
}

describe("CommandRegistry", () => {
  describe("classifyCommand", () => {
    it("classifies safe commands", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/help")).toBe("safe");
      expect(registry.classifyCommand("/list")).toBe("safe");
      expect(registry.classifyCommand("/shop")).toBe("safe");
      expect(registry.classifyCommand("/bal")).toBe("safe");
      expect(registry.classifyCommand("/rtp")).toBe("safe");
      expect(registry.classifyCommand("/tpa")).toBe("safe");
      expect(registry.classifyCommand("/home")).toBe("safe");
      expect(registry.classifyCommand("/warp")).toBe("safe");
    });

    it("classifies dangerous commands", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/ban")).toBe("dangerous");
      expect(registry.classifyCommand("/kick")).toBe("dangerous");
      expect(registry.classifyCommand("/ban-ip")).toBe("dangerous");
    });

    it("classifies admin commands", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/op")).toBe("admin");
      expect(registry.classifyCommand("/stop")).toBe("admin");
      expect(registry.classifyCommand("/save-all")).toBe("admin");
      expect(registry.classifyCommand("/reload")).toBe("admin");
    });

    it("classifies commands that are both dangerous and admin as dangerous", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/deop")).toBe("dangerous");
      expect(registry.classifyCommand("/whitelist")).toBe("dangerous");
    });

    it("classifies unknown commands as moderate", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/someunknown")).toBe("moderate");
      expect(registry.classifyCommand("/custom")).toBe("moderate");
    });

    it("does NOT classify /shop as dangerous (substring false positive)", () => {
      const registry = createCommandRegistry(logger);
      const safety = registry.classifyCommand("/shop");
      expect(safety).toBe("safe");
      expect(safety).not.toBe("dangerous");
    });

    it("does NOT classify /whitelistlist as dangerous (exact match required)", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyCommand("/whitelistlist")).toBe("moderate");
    });
  });

  describe("classifyFullCommand", () => {
    it("flags dangerous arguments", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyFullCommand("/give @a diamond")).toBe("dangerous");
      expect(registry.classifyFullCommand("/effect @e speed")).toBe("dangerous");
      expect(registry.classifyFullCommand("/tp @s 100 64 100")).toBe("dangerous");
      expect(registry.classifyFullCommand("/kill @e")).toBe("dangerous");
      expect(registry.classifyFullCommand("/gamemode creative")).toBe("dangerous");
    });

    it("does not flag safe arguments", () => {
      const registry = createCommandRegistry(logger);
      expect(registry.classifyFullCommand("/help")).toBe("safe");
      expect(registry.classifyFullCommand("/bal")).toBe("safe");
      expect(registry.classifyFullCommand("/rtp")).toBe("safe");
    });
  });

  describe("register and get", () => {
    it("registers and retrieves a command", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "test", description: "Test command", safety: "safe" });
      store = registry.register(store, cmd);
      const retrieved = registry.get(store, "test");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe("test");
      expect(retrieved!.safety).toBe("safe");
    });

    it("returns null for unknown commands", () => {
      const registry = createCommandRegistry(logger);
      const store = emptyStore();
      expect(registry.get(store, "nonexistent")).toBeNull();
    });
  });

  describe("canExecute", () => {
    it("allows safe commands", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "help", safety: "safe", confidence: 0.8 });
      store = registry.register(store, cmd);
      const result = registry.canExecute(store, "help");
      expect(result.allowed).toBe(true);
    });

    it("blocks unknown commands", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "unknown", safety: "unknown" });
      store = registry.register(store, cmd);
      const result = registry.canExecute(store, "unknown");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not yet classified");
    });

    it("blocks dangerous commands", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "ban", safety: "dangerous" });
      store = registry.register(store, cmd);
      const result = registry.canExecute(store, "ban");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("dangerous");
    });

    it("blocks admin commands", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "op", safety: "admin" });
      store = registry.register(store, cmd);
      const result = registry.canExecute(store, "op");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("admin");
    });

    it("blocks moderate commands with low confidence", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "custom", safety: "moderate", confidence: 0.3 });
      store = registry.register(store, cmd);
      const result = registry.canExecute(store, "custom");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("confidence too low");
    });

    it("blocks commands on cooldown", () => {
      const registry = createCommandRegistry(logger);
      let store = emptyStore();
      const cmd = createServerCommand({ name: "help", safety: "safe", confidence: 0.8 });
      store = registry.register(store, cmd);
      store = registry.setCooldown(store, "help", 60000);
      const result = registry.canExecute(store, "help");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("cooldown");
    });

    it("blocks unknown command names", () => {
      const registry = createCommandRegistry(logger);
      const store = emptyStore();
      const result = registry.canExecute(store, "nonexistent");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unknown command");
    });
  });
});
