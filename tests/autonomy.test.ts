import { describe, it, expect } from "vitest";
import { createPlanner } from "../src/autonomy/planner.js";
import { createGoal } from "../src/goals/goal.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

const mockWorld = { time: 6000, isDaytime: true, weather: "clear", nearbyBlocks: [], nearbyEntities: [], position: { x: 0, y: 64, z: 0 }, biome: "plains" };
const mockInventory = { items: [], armor: [], totalItems: 0, isFull: false, hasFood: false, hasPickaxe: false, hasSword: false };
const mockHealth = { healthy: true, health: 20, hunger: 20, issues: [] };

describe("Planner", () => {
  it("creates a plan for home goal", () => {
    const planner = createPlanner();
    const goal = createGoal({ description: "Build home", type: "xykeel-own", priority: 9, metadata: { category: "home" } });
    const plan = planner.createPlan(goal, mockWorld, mockInventory, mockHealth);
    expect(plan.actions.length).toBeGreaterThanOrEqual(3);
    expect(plan.actions[0].type).toBe("find_location");
  });

  it("creates a plan for mining goal", () => {
    const planner = createPlanner();
    const goal = createGoal({ description: "Mine iron", type: "xykeel-own", priority: 7, metadata: { category: "mining" } });
    const plan = planner.createPlan(goal, mockWorld, mockInventory, mockHealth);
    expect(plan.actions[0].type).toBe("prepare_equipment");
  });

  it("creates a plan for business goal", () => {
    const planner = createPlanner();
    const goal = createGoal({ description: "Start shop", type: "xykeel-own", priority: 4, metadata: { category: "business" } });
    const plan = planner.createPlan(goal, mockWorld, mockInventory, mockHealth);
    expect(plan.actions[0].type).toBe("evaluate_opportunities");
  });

  it("creates generic plan for unknown category", () => {
    const planner = createPlanner();
    const goal = createGoal({ description: "Do something", type: "xykeel-own", priority: 5 });
    const plan = planner.createPlan(goal, mockWorld, mockInventory, mockHealth);
    expect(plan.actions.length).toBe(2);
  });
});
