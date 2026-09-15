import type { XykeelLogger } from "../logging/logger.js";
import type { InventoryState, TrackedItem } from "../minecraft/inventory.js";

export type ToolTier = "none" | "wooden" | "stone" | "iron" | "golden" | "diamond" | "netherite";
export type ArmorTier = "none" | "leather" | "chainmail" | "iron" | "golden" | "diamond" | "netherite";

export interface EquipmentEvaluation {
  tools: {
    pickaxe: { tier: ToolTier; durability: number; maxDurability: number; needsUpgrade: boolean };
    sword: { tier: ToolTier; durability: number; maxDurability: number; needsUpgrade: boolean };
    axe: { tier: ToolTier; durability: number; maxDurability: number; needsUpgrade: boolean };
    hoe: { tier: ToolTier; durability: number; maxDurability: number; needsUpgrade: boolean };
  };
  armor: {
    helmet: { tier: ArmorTier; durability: number; maxDurability: number; equipped: boolean };
    chestplate: { tier: ArmorTier; durability: number; maxDurability: number; equipped: boolean };
    leggings: { tier: ArmorTier; durability: number; maxDurability: number; equipped: boolean };
    boots: { tier: ArmorTier; durability: number; maxDurability: number; equipped: boolean };
  };
  food: { count: number; quality: "none" | "poor" | "adequate" | "good" | "excellent" };
  materials: {
    wood: number;
    stone: number;
    iron: number;
    gold: number;
    diamond: number;
    cobblestone: number;
    dirt: number;
    seeds: number;
  };
  overallRating: "defenseless" | "minimal" | "basic" | "adequate" | "good" | "excellent";
  missingUpgrades: string[];
  priorities: string[];
}

const TOOL_TIER_ORDER: ToolTier[] = ["none", "wooden", "stone", "iron", "golden", "diamond", "netherite"];

const TOOL_PATTERNS: Record<string, ToolTier> = {
  netherite_pickaxe: "netherite", diamond_pickaxe: "diamond", iron_pickaxe: "iron",
  stone_pickaxe: "stone", golden_pickaxe: "golden", wooden_pickaxe: "wooden",
  netherite_sword: "netherite", diamond_sword: "diamond", iron_sword: "iron",
  stone_sword: "stone", golden_sword: "golden", wooden_sword: "wooden",
  netherite_axe: "netherite", diamond_axe: "diamond", iron_axe: "iron",
  stone_axe: "stone", golden_axe: "golden", wooden_axe: "wooden",
  netherite_hoe: "netherite", diamond_hoe: "diamond", iron_hoe: "iron",
  stone_hoe: "stone", golden_hoe: "golden", wooden_hoe: "wooden",
};

const ARMOR_PATTERNS: Record<string, { slot: keyof EquipmentEvaluation["armor"]; tier: ArmorTier }> = {
  netherite_helmet: { slot: "helmet", tier: "netherite" },
  diamond_helmet: { slot: "helmet", tier: "diamond" },
  iron_helmet: { slot: "helmet", tier: "iron" },
  chainmail_helmet: { slot: "helmet", tier: "chainmail" },
  golden_helmet: { slot: "helmet", tier: "golden" },
  leather_helmet: { slot: "helmet", tier: "leather" },
  netherite_chestplate: { slot: "chestplate", tier: "netherite" },
  diamond_chestplate: { slot: "chestplate", tier: "diamond" },
  iron_chestplate: { slot: "chestplate", tier: "iron" },
  chainmail_chestplate: { slot: "chestplate", tier: "chainmail" },
  golden_chestplate: { slot: "chestplate", tier: "golden" },
  leather_chestplate: { slot: "chestplate", tier: "leather" },
  netherite_leggings: { slot: "leggings", tier: "netherite" },
  diamond_leggings: { slot: "leggings", tier: "diamond" },
  iron_leggings: { slot: "leggings", tier: "iron" },
  chainmail_leggings: { slot: "leggings", tier: "chainmail" },
  golden_leggings: { slot: "leggings", tier: "golden" },
  leather_leggings: { slot: "leggings", tier: "leather" },
  netherite_boots: { slot: "boots", tier: "netherite" },
  diamond_boots: { slot: "boots", tier: "diamond" },
  iron_boots: { slot: "boots", tier: "iron" },
  chainmail_boots: { slot: "boots", tier: "chainmail" },
  golden_boots: { slot: "boots", tier: "golden" },
  leather_boots: { slot: "boots", tier: "leather" },
};

const FOOD_ITEMS = [
  "bread", "cooked_beef", "cooked_porkchop", "cooked_mutton",
  "cooked_chicken", "cooked_rabbit", "cooked_cod", "cooked_salmon",
  "baked_potato", "pumpkin_pie", "golden_carrot", "golden_apple",
  "apple", "carrot", "potato", "beetroot",
];

const EXCELLENT_FOOD = new Set(["golden_apple", "golden_carrot", "cooked_beef", "cooked_porkchop", "cooked_chicken"]);
const GOOD_FOOD = new Set(["bread", "cooked_mutton", "cooked_rabbit", "cooked_cod", "cooked_salmon", "baked_potato"]);
const ADEQUATE_FOOD = new Set(["apple", "carrot", "potato", "beetroot", "pumpkin_pie"]);

function getToolTier(name: string): ToolTier {
  return TOOL_PATTERNS[name] ?? "none";
}

function tierRank(tier: ToolTier | ArmorTier): number {
  return (TOOL_TIER_ORDER as string[]).indexOf(tier);
}

export function evaluateEquipment(logger: XykeelLogger, inventory: InventoryState): EquipmentEvaluation {
  const toolEval = (prefix: string): EquipmentEvaluation["tools"]["pickaxe"] => {
    let bestTier: ToolTier = "none";
    let durability = 0;
    let maxDurability = 0;
    let bestItem: TrackedItem | null = null;

    for (const item of inventory.items) {
      if (item.name.includes(prefix)) {
        const tier = getToolTier(item.name);
        if (tierRank(tier) > tierRank(bestTier)) {
          bestTier = tier;
          bestItem = item;
        } else if (tier === bestTier && bestItem) {
          if (item.remainingDurability > bestItem.remainingDurability) {
            bestItem = item;
          }
        }
      }
    }

    if (bestItem && bestItem.maxDurability > 0) {
      durability = bestItem.remainingDurability;
      maxDurability = bestItem.maxDurability;
    }

    return {
      tier: bestTier,
      durability,
      maxDurability,
      needsUpgrade: tierRank(bestTier) < tierRank("iron"),
    };
  };

  const armorEval = (slot: keyof EquipmentEvaluation["armor"]): EquipmentEvaluation["armor"]["helmet"] => {
    let tier: ArmorTier = "none";
    let durability = 0;
    let maxDurability = 0;

    for (const item of inventory.armor) {
      const info = Object.entries(ARMOR_PATTERNS).find(([pattern]) => item.name.includes(pattern));
      if (info && info[1].slot === slot) {
        tier = info[1].tier;
        if (item.maxDurability > 0) {
          durability = item.remainingDurability;
          maxDurability = item.maxDurability;
        }
      }
    }

    return { tier, durability, maxDurability, equipped: tier !== "none" };
  };

  const tools = {
    pickaxe: toolEval("pickaxe"),
    sword: toolEval("sword"),
    axe: toolEval("axe"),
    hoe: toolEval("hoe"),
  };

  const armor = {
    helmet: armorEval("helmet"),
    chestplate: armorEval("chestplate"),
    leggings: armorEval("leggings"),
    boots: armorEval("boots"),
  };

  const foodItems = inventory.items.filter((item) => FOOD_ITEMS.includes(item.name));
  const foodCount = foodItems.reduce((sum, item) => sum + item.count, 0);

  let foodQuality: EquipmentEvaluation["food"]["quality"] = "none";
  if (foodCount > 0) {
    if (foodItems.some((i) => EXCELLENT_FOOD.has(i.name))) foodQuality = "excellent";
    else if (foodItems.some((i) => GOOD_FOOD.has(i.name))) foodQuality = "good";
    else if (foodItems.some((i) => ADEQUATE_FOOD.has(i.name))) foodQuality = "adequate";
    else foodQuality = "poor";
  }

  const isToolOrArmor = (name: string): boolean =>
    name.includes("_pickaxe") || name.includes("_sword") || name.includes("_axe") ||
    name.includes("_hoe") || name.includes("_helmet") || name.includes("_chestplate") ||
    name.includes("_leggings") || name.includes("_boots") || name.includes("_shovel");

  const materials = {
    wood: inventory.items.filter((i) => (i.name.includes("_log") || i.name === "stick" || i.name.includes("_plank")) && !isToolOrArmor(i.name)).reduce((s, i) => s + i.count, 0),
    stone: inventory.items.filter((i) => (i.name === "cobblestone" || i.name === "stone" || i.name === "deepslate") && !isToolOrArmor(i.name)).reduce((s, i) => s + i.count, 0),
    iron: inventory.items.filter((i) => (i.name === "iron_ingot" || i.name === "raw_iron" || i.name === "iron_nugget") && !isToolOrArmor(i.name)).reduce((s, i) => s + i.count, 0),
    gold: inventory.items.filter((i) => (i.name === "gold_ingot" || i.name === "raw_gold" || i.name === "gold_nugget") && !isToolOrArmor(i.name)).reduce((s, i) => s + i.count, 0),
    diamond: inventory.items.filter((i) => (i.name === "diamond" || i.name === "raw_diamond") && !isToolOrArmor(i.name)).reduce((s, i) => s + i.count, 0),
    cobblestone: inventory.items.filter((i) => i.name === "cobblestone").reduce((s, i) => s + i.count, 0),
    dirt: inventory.items.filter((i) => i.name === "dirt" || i.name === "coarse_dirt" || i.name === "grass_block").reduce((s, i) => s + i.count, 0),
    seeds: inventory.items.filter((i) => i.name.includes("seeds")).reduce((s, i) => s + i.count, 0),
  };

  const avgToolTier = [tools.pickaxe, tools.sword, tools.axe]
    .reduce((sum, t) => sum + tierRank(t.tier), 0) / 3;

  const armorCount = [armor.helmet, armor.chestplate, armor.leggings, armor.boots]
    .filter((a) => a.tier !== "none").length;

  let overallRating: EquipmentEvaluation["overallRating"];
  if (avgToolTier <= 0.5 && armorCount === 0) overallRating = "defenseless";
  else if (avgToolTier <= 1 && armorCount <= 1) overallRating = "minimal";
  else if (avgToolTier <= 2 && armorCount <= 2) overallRating = "basic";
  else if (avgToolTier <= 3 && armorCount <= 3) overallRating = "adequate";
  else if (avgToolTier <= 4 || armorCount === 4) overallRating = "good";
  else overallRating = "excellent";

  const missingUpgrades: string[] = [];
  const priorities: string[] = [];

  if (tools.pickaxe.needsUpgrade) missingUpgrades.push("Upgrade pickaxe to iron or better");
  if (tools.sword.needsUpgrade) missingUpgrades.push("Upgrade sword to iron or better");
  if (!armor.helmet.equipped) missingUpgrades.push("Obtain helmet");
  if (!armor.chestplate.equipped) missingUpgrades.push("Obtain chestplate");
  if (!armor.leggings.equipped) missingUpgrades.push("Obtain leggings");
  if (!armor.boots.equipped) missingUpgrades.push("Obtain boots");
  if (foodQuality === "none") missingUpgrades.push("Obtain food");
  else if (foodQuality === "poor") missingUpgrades.push("Find better food source");

  if (foodCount < 10) priorities.push("Increase food supply");
  if (tools.pickaxe.tier === "none") priorities.push("Obtain pickaxe");
  if (tools.sword.tier === "none") priorities.push("Obtain sword for defense");
  if (armorCount === 0) priorities.push("Start collecting armor");
  if (tools.pickaxe.tier !== "none" && tools.pickaxe.tier !== "iron" && tools.pickaxe.tier !== "diamond" && tools.pickaxe.tier !== "netherite") {
    priorities.push("Upgrade pickaxe tier");
  }

  logger.action(`Equipment evaluation: ${overallRating} | Tools: ${tools.pickaxe.tier}/${tools.sword.tier}/${tools.axe.tier} | Armor: ${armorCount}/4 | Food: ${foodCount} (${foodQuality})`);

  return {
    tools,
    armor,
    food: { count: foodCount, quality: foodQuality },
    materials,
    overallRating,
    missingUpgrades,
    priorities,
  };
}
