import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logging/logger.js";

describe("Logger", () => {
  it("creates a logger with console output", () => {
    const logger = createLogger({ level: "info", output: "console", path: "/dev/null" });
    expect(logger).toBeDefined();
    expect(typeof logger.connection).toBe("function");
    expect(typeof logger.goal).toBe("function");
    expect(typeof logger.decision).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.chat).toBe("function");
    expect(typeof logger.handoff).toBe("function");
  });

  it("has all category methods", () => {
    const logger = createLogger({ level: "debug", output: "console", path: "/dev/null" });
    const methods = [
      "connection", "disconnection", "handoff", "goal", "decision",
      "action", "error", "survival", "business", "memory", "chat",
      "system", "state",
    ] as const;

    for (const method of methods) {
      expect(typeof logger[method]).toBe("function");
    }
  });

  it("does not throw when logging", () => {
    const logger = createLogger({ level: "info", output: "console", path: "/dev/null" });
    expect(() => {
      logger.connection("Test connection message");
      logger.goal("Test goal message", { priority: 5 });
      logger.decision("Test decision");
      logger.error("Test error", { stack: "fake" });
      logger.chat("Test chat", { sender: "Player1" });
    }).not.toThrow();
  });
});
