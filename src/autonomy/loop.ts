import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";
import type { WorldState } from "../minecraft/world.js";
import type { InventoryState } from "../minecraft/inventory.js";
import type { HealthCheck } from "../safety/health.js";
import type { Goal } from "../goals/goal.js";
import type { Plan, Planner } from "./planner.js";

export interface AutonomousLoop {
  tick(params: {
    bot: Bot;
    world: WorldState;
    inventory: InventoryState;
    health: HealthCheck;
    goals: Goal[];
    planner: Planner;
  }): Promise<Plan | null>;
}

export function createAutonomousLoop(logger: XykeelLogger): AutonomousLoop {
  let currentPlan: Plan | null = null;
  let currentActionIndex = 0;
  let lastTick = 0;
  const TICK_INTERVAL = 1000;

  async function tick(params: {
    bot: Bot;
    world: WorldState;
    inventory: InventoryState;
    health: HealthCheck;
    goals: Goal[];
    planner: Planner;
  }): Promise<Plan | null> {
    const now = Date.now();
    if (now - lastTick < TICK_INTERVAL) return currentPlan;
    lastTick = now;

    const { world, inventory, health, goals, planner } = params;

    // If current plan is complete or stuck, create a new one
    if (!currentPlan || currentActionIndex >= currentPlan.actions.length) {
      // Find the highest priority pending goal
      const pendingGoals = goals
        .filter((g) => g.status === "pending" || g.status === "active")
        .sort((a, b) => b.priority - a.priority);

      if (pendingGoals.length === 0) {
        logger.decision("No active goals — idling");
        return null;
      }

      const nextGoal = pendingGoals[0];
      currentPlan = planner.createPlan(nextGoal, world, inventory, health);
      currentActionIndex = 0;

      logger.goal(`New plan for: ${nextGoal.description}`, {
        actions: currentPlan.actions.length,
      });
    }

    // Execute current action
    const action = currentPlan.actions[currentActionIndex];
    if (action) {
      logger.action(`Executing: ${action.description}`);
      // TODO: Actually execute actions via Minecraft layer
      // For now, advance to next action
      currentActionIndex++;

      if (currentActionIndex >= currentPlan.actions.length) {
        logger.decision(`Plan complete for goal: ${currentPlan.goalId}`);
        currentPlan = null;
      }
    }

    return currentPlan;
  }

  function resetPlan(): void {
    currentPlan = null;
    currentActionIndex = 0;
  }

  return { tick, resetPlan } as unknown as AutonomousLoop;
}
