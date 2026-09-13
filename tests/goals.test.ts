import { describe, it, expect } from "vitest";
import {
  createGoal,
  prioritizeGoals,
  completeGoal,
  abandonGoal,
} from "../src/goals/goal.js";

describe("Goals", () => {
  it("creates a goal with defaults", () => {
    const goal = createGoal({
      description: "Build a house",
      type: "xykeel-own",
      priority: 7,
    });
    expect(goal.description).toBe("Build a house");
    expect(goal.type).toBe("xykeel-own");
    expect(goal.priority).toBe(7);
    expect(goal.status).toBe("pending");
    expect(goal.id).toBeDefined();
    expect(goal.subtasks).toEqual([]);
  });

  it("prioritizes goals by priority then type", () => {
    const goals = [
      createGoal({ description: "Low", type: "xykeel-own", priority: 2 }),
      createGoal({ description: "High", type: "xykeel-own", priority: 9 }),
      createGoal({ description: "Player", type: "player-requested", priority: 5 }),
    ];
    const sorted = prioritizeGoals(goals);
    expect(sorted[0].description).toBe("High");
    // Player-requested at 5 gets +0.5 boost = 5.5, which is above 5 but below 9
    expect(sorted[1].description).toBe("Player");
    expect(sorted[2].description).toBe("Low");
  });

  it("excludes completed and abandoned goals", () => {
    let goal = createGoal({ description: "Done", type: "xykeel-own", priority: 5 });
    goal = completeGoal(goal);
    const goals = [
      goal,
      createGoal({ description: "Active", type: "xykeel-own", priority: 3 }),
    ];
    const sorted = prioritizeGoals(goals);
    expect(sorted.length).toBe(1);
    expect(sorted[0].description).toBe("Active");
  });

  it("completes a goal", () => {
    const goal = createGoal({ description: "Test", type: "xykeel-own", priority: 5 });
    const completed = completeGoal(goal);
    expect(completed.status).toBe("completed");
    expect(completed.updatedAt).toBeGreaterThanOrEqual(goal.createdAt);
  });

  it("abandons a goal", () => {
    const goal = createGoal({ description: "Test", type: "xykeel-own", priority: 5 });
    const abandoned = abandonGoal(goal);
    expect(abandoned.status).toBe("abandoned");
  });
});
