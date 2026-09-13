import { describe, it, expect } from "vitest";
import { createNavigation } from "../src/navigation/navigator.js";
import { createSurvivalActions } from "../src/survival/actions.js";
import { createGathering } from "../src/survival/gathering.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

// Minimal mock bot for navigation tests
function mockBot() {
  const listeners: Record<string, Function[]> = {};
  return {
    entity: { position: { x: 0, y: 64, z: 0, clone() { return { ...this }; }, distanceTo() { return 0; } } },
    version: "1.21.1",
    pathfinder: {
      setMovements() {},
      setGoal() {},
    },
    on(event: string, fn: Function) {
      (listeners[event] ??= []).push(fn);
    },
    removeListener(event: string, fn: Function) {
      const arr = listeners[event];
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      }
    },
  } as never;
}

describe("Navigation", () => {
  it("creates navigation system", () => {
    const nav = createNavigation(logger);
    expect(typeof nav.moveTo).toBe("function");
    expect(typeof nav.moveAway).toBe("function");
    expect(typeof nav.getPath).toBe("function");
    expect(typeof nav.getCurrentPosition).toBe("function");
    expect(typeof nav.distanceTo).toBe("function");
    expect(typeof nav.initMovements).toBe("function");
    expect(typeof nav.cancelCurrent).toBe("function");
  });

  it("calculates distance correctly", () => {
    const nav = createNavigation(logger);
    expect(nav.distanceTo({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(nav.distanceTo({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0);
  });

  it("getPath returns target", () => {
    const nav = createNavigation(logger);
    const bot = mockBot();
    const path = nav.getPath(bot, { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    expect(path.length).toBe(1);
    expect(path[0]).toEqual({ x: 10, y: 10, z: 10 });
  });

  it("moveTo returns false when pathfinder fails", async () => {
    const nav = createNavigation(logger);
    const bot = mockBot();
    const result = await nav.moveTo(bot, { x: 10, y: 64, z: 10 }, 2000);
    expect(result).toBe(false);
  });

  it("cancelCurrent does not throw", () => {
    const nav = createNavigation(logger);
    expect(() => nav.cancelCurrent()).not.toThrow();
  });
});

describe("Survival Actions", () => {
  it("creates survival actions", () => {
    const actions = createSurvivalActions(logger);
    expect(typeof actions.eat).toBe("function");
    expect(typeof actions.retreat).toBe("function");
    expect(typeof actions.equipBestTool).toBe("function");
    expect(typeof actions.avoidThreats).toBe("function");
  });
});

describe("Gathering", () => {
  it("creates gathering system", () => {
    const gathering = createGathering(logger);
    expect(typeof gathering.chopTree).toBe("function");
    expect(typeof gathering.mineBlock).toBe("function");
    expect(typeof gathering.collectNearby).toBe("function");
  });
});
