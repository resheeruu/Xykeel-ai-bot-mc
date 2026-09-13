import { describe, it, expect } from "vitest";
import { createNavigation } from "../src/navigation/navigator.js";
import { createSurvivalActions } from "../src/survival/actions.js";
import { createGathering } from "../src/survival/gathering.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

describe("Navigation", () => {
  it("creates navigation system", () => {
    const nav = createNavigation(logger);
    expect(typeof nav.moveTo).toBe("function");
    expect(typeof nav.moveAway).toBe("function");
    expect(typeof nav.getPath).toBe("function");
    expect(typeof nav.getCurrentPosition).toBe("function");
    expect(typeof nav.distanceTo).toBe("function");
  });

  it("calculates distance correctly", () => {
    const nav = createNavigation(logger);
    expect(nav.distanceTo({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(nav.distanceTo({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0);
  });

  it("getPath returns target", () => {
    const nav = createNavigation(logger);
    const path = nav.getPath({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    expect(path.length).toBe(1);
    expect(path[0]).toEqual({ x: 10, y: 10, z: 10 });
  });

  it("moveTo returns false when pathfinder unavailable", async () => {
    const nav = createNavigation(logger);
    const result = await nav.moveTo({ x: 10, y: 64, z: 10 });
    expect(result).toBe(false);
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
