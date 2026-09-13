import type { Goal } from "../goals/goal.js";
import type { WorldState } from "../minecraft/world.js";
import type { InventoryState } from "../minecraft/inventory.js";
import type { HealthCheck } from "../safety/health.js";

export interface Plan {
  goalId: string;
  actions: PlanAction[];
  createdAt: number;
}

export interface PlanAction {
  type: string;
  description: string;
  priority: number;
  params: Record<string, unknown>;
}

export interface Planner {
  createPlan(
    goal: Goal,
    world: WorldState,
    inventory: InventoryState,
    health: HealthCheck
  ): Plan;
}

export function createPlanner(): Planner {
  function createPlan(
    goal: Goal,
    _world: WorldState,
    _inventory: InventoryState,
    _health: HealthCheck
  ): Plan {
    const meta = goal.metadata as { category?: string };
    const category = meta.category ?? "general";

    let actions: PlanAction[] = [];

    switch (category) {
      case "home":
        actions = [
          { type: "find_location", description: "Find a suitable home location", priority: 1, params: {} },
          { type: "gather_materials", description: "Gather building materials", priority: 2, params: { materials: ["oak_log", "cobblestone"] } },
          { type: "build_structure", description: "Build basic shelter", priority: 3, params: {} },
          { type: "place_bed", description: "Place a bed", priority: 4, params: {} },
          { type: "place_chest", description: "Place storage chest", priority: 5, params: {} },
        ];
        break;
      case "farming":
        actions = [
          { type: "find_farmland", description: "Find or create farmland", priority: 1, params: {} },
          { type: "gather_seeds", description: "Gather seeds", priority: 2, params: {} },
          { type: "till_soil", description: "Till soil for planting", priority: 3, params: {} },
          { type: "plant_crops", description: "Plant crops", priority: 4, params: {} },
          { type: "harvest", description: "Harvest mature crops", priority: 5, params: {} },
        ];
        break;
      case "mining":
        actions = [
          { type: "prepare_equipment", description: "Ensure pickaxe and food", priority: 1, params: {} },
          { type: "find_mine", description: "Locate mining area", priority: 2, params: {} },
          { type: "mine_resources", description: "Mine target resources", priority: 3, params: {} },
          { type: "return_home", description: "Return to base with resources", priority: 4, params: {} },
          { type: "store_resources", description: "Store mined resources", priority: 5, params: {} },
        ];
        break;
      case "storage":
        actions = [
          { type: "locate_storage", description: "Find existing storage", priority: 1, params: {} },
          { type: "organize_items", description: "Sort and organize inventory", priority: 2, params: {} },
          { type: "expand_storage", description: "Create additional storage", priority: 3, params: {} },
        ];
        break;
      case "exploration":
        actions = [
          { type: "prepare_supplies", description: "Ensure food and tools", priority: 1, params: {} },
          { type: "explore_area", description: "Explore surrounding area", priority: 2, params: {} },
          { type: "mark_locations", description: "Record interesting locations", priority: 3, params: {} },
          { type: "return_base", description: "Return to base", priority: 4, params: {} },
        ];
        break;
      case "building":
        actions = [
          { type: "gather_materials", description: "Gather construction materials", priority: 1, params: {} },
          { type: "design_structure", description: "Plan the build", priority: 2, params: {} },
          { type: "build_structure", description: "Construct the project", priority: 3, params: {} },
          { type: "decorate", description: "Add finishing touches", priority: 4, params: {} },
        ];
        break;
      case "business":
        actions = [
          { type: "evaluate_opportunities", description: "Assess business options", priority: 1, params: {} },
          { type: "gather_resources", description: "Gather business resources", priority: 2, params: {} },
          { type: "produce_inventory", description: "Create sellable items", priority: 3, params: {} },
          { type: "setup_shop", description: "Establish shop location", priority: 4, params: {} },
          { type: "manage_sales", description: "Manage trades and sales", priority: 5, params: {} },
        ];
        break;
      default:
        actions = [
          { type: "assess", description: "Assess situation", priority: 1, params: {} },
          { type: "act", description: "Take appropriate action", priority: 2, params: {} },
        ];
    }

    return {
      goalId: goal.id,
      actions,
      createdAt: Date.now(),
    };
  }

  return { createPlan };
}
