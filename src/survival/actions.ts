import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";
import type { InventoryState } from "../minecraft/inventory.js";
import { goals } from "mineflayer-pathfinder";

export interface SurvivalActions {
  eat(bot: Bot, inventory: InventoryState): Promise<boolean>;
  retreat(bot: Bot): Promise<boolean>;
  equipBestTool(bot: Bot, toolType: "pickaxe" | "sword" | "axe"): Promise<boolean>;
  avoidThreats(bot: Bot): Promise<boolean>;
}

const FOOD_ITEMS = [
  "bread", "cooked_beef", "cooked_porkchop", "cooked_mutton",
  "cooked_chicken", "cooked_rabbit", "cooked_cod", "cooked_salmon",
  "baked_potato", "pumpkin_pie", "golden_carrot", "golden_apple",
  "apple", "carrot", "potato", "beetroot",
];

const TOOL_PRIORITY: Record<string, string[]> = {
  pickaxe: ["netherite_pickaxe", "diamond_pickaxe", "iron_pickaxe", "stone_pickaxe", "golden_pickaxe", "wooden_pickaxe"],
  sword: ["netherite_sword", "diamond_sword", "iron_sword", "stone_sword", "golden_sword", "wooden_sword"],
  axe: ["netherite_axe", "diamond_axe", "iron_axe", "stone_axe", "golden_axe", "wooden_axe"],
};

export function createSurvivalActions(logger: XykeelLogger): SurvivalActions {
  async function eat(bot: Bot, inventory: InventoryState): Promise<boolean> {
    if (inventory.hasFood) {
      const foodItem = bot.inventory.items().find((item) => FOOD_ITEMS.includes(item.name));
      if (foodItem) {
        try {
          await bot.equip(foodItem, "hand");
          await bot.consume();
          logger.survival(`Ate ${foodItem.name}`);
          return true;
        } catch (err) {
          logger.error(`Failed to eat: ${err}`);
          return false;
        }
      }
    }
    logger.survival("No food available to eat");
    return false;
  }

  async function retreat(bot: Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;
    logger.survival("Retreating from danger");

    const pos = bot.entity.position;
    const safePos = { x: pos.x + 10, y: pos.y, z: pos.z + 10 };

    try {
      const bf = bot as unknown as { pathfinder?: { setGoal: (g: unknown) => void } };
      if (bf.pathfinder) {
        bf.pathfinder.setGoal(new goals.GoalBlock(safePos.x, safePos.y, safePos.z));
        logger.survival("Retreat path set");
        return true;
      }
      logger.survival("Pathfinder not available for retreat");
      return false;
    } catch {
      logger.survival("Pathfinder not available for retreat");
      return false;
    }
  }

  async function equipBestTool(bot: Bot, toolType: "pickaxe" | "sword" | "axe"): Promise<boolean> {
    const priorities = TOOL_PRIORITY[toolType];
    for (const toolName of priorities) {
      const item = bot.inventory.items().find((i) => i.name === toolName);
      if (item) {
        try {
          await bot.equip(item, "hand");
          logger.action(`Equipped ${toolName}`);
          return true;
        } catch {
          // Try next tool
        }
      }
    }
    logger.survival(`No ${toolType} available to equip`);
    return false;
  }

  async function avoidThreats(bot: Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;

    const hostiles = Object.values(bot.entities).filter((entity) => {
      if (!entity.position) return false;
      const dist = bot.entity.position.distanceTo(entity.position);
      return dist < 16 && isHostile(entity.name ?? entity.type);
    });

    if (hostiles.length === 0) return false;

    logger.survival(`Detected ${hostiles.length} hostile(s) — avoiding`);
    return retreat(bot);
  }

  return { eat, retreat, equipBestTool, avoidThreats };
}

function isHostile(name: string): boolean {
  const hostiles = [
    "zombie", "skeleton", "spider", "creeper", "enderman",
    "witch", "slime", "phantom", "drowned", "husk",
    "stray", "cave_spider", "blaze", "ghast",
  ];
  return hostiles.includes(name.toLowerCase());
}
