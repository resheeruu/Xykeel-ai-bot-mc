import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface TrackedItem {
  name: string;
  count: number;
  slot: number;
  durabilityUsed: number;
  maxDurability: number;
  remainingDurability: number;
}

export interface TrackedArmor {
  name: string;
  slot: number;
  durabilityUsed: number;
  maxDurability: number;
  remainingDurability: number;
}

export interface InventoryState {
  items: TrackedItem[];
  armor: TrackedArmor[];
  totalItems: number;
  isFull: boolean;
  hasFood: boolean;
  hasPickaxe: boolean;
  hasSword: boolean;
}

export interface InventoryTracker {
  state: InventoryState;
  update(bot: Bot): void;
  getState(): InventoryState;
  getItemCount(bot: Bot, itemName: string): number;
  hasItem(bot: Bot, itemName: string): boolean;
}

const FOOD_ITEMS = [
  "bread", "cooked_beef", "cooked_porkchop", "cooked_mutton",
  "cooked_chicken", "cooked_rabbit", "cooked_cod", "cooked_salmon",
  "baked_potato", "pumpkin_pie", "golden_carrot", "golden_apple",
  "apple", "carrot", "potato", "beetroot",
];

const PICKAXE_ITEMS = [
  "wooden_pickaxe", "stone_pickaxe", "iron_pickaxe",
  "golden_pickaxe", "diamond_pickaxe", "netherite_pickaxe",
];

const SWORD_ITEMS = [
  "wooden_sword", "stone_sword", "iron_sword",
  "golden_sword", "diamond_sword", "netherite_sword",
];

export function createInventoryTracker(_logger: XykeelLogger): InventoryTracker {
  const state: InventoryState = {
    items: [],
    armor: [],
    totalItems: 0,
    isFull: false,
    hasFood: false,
    hasPickaxe: false,
    hasSword: false,
  };

  function update(bot: Bot): void {
    const items = bot.inventory.items().map((item) => {
      const durabilityUsed = typeof item.durabilityUsed === "number" ? item.durabilityUsed : 0;
      const maxDurability = typeof item.maxDurability === "number" ? item.maxDurability : 0;
      return {
        name: item.name,
        count: item.count,
        slot: item.slot,
        durabilityUsed,
        maxDurability,
        remainingDurability: maxDurability > 0 ? maxDurability - durabilityUsed : 0,
      };
    });

    const armor = bot.inventory.slots
      ? bot.inventory.slots
          .slice(5, 9)
          .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
          .map((slot) => {
            const durabilityUsed = typeof slot.durabilityUsed === "number" ? slot.durabilityUsed : 0;
            const maxDurability = typeof slot.maxDurability === "number" ? slot.maxDurability : 0;
            return {
              name: slot.name,
              slot: slot.slot,
              durabilityUsed,
              maxDurability,
              remainingDurability: maxDurability > 0 ? maxDurability - durabilityUsed : 0,
            };
          })
      : [];

    const totalItems = items.reduce((sum, item) => sum + item.count, 0);
    const isFull = bot.inventory.emptySlotCount() === 0;
    const hasFood = items.some((item) => FOOD_ITEMS.includes(item.name));
    const hasPickaxe = items.some((item) => PICKAXE_ITEMS.includes(item.name));
    const hasSword = items.some((item) => SWORD_ITEMS.includes(item.name));

    state.items = items;
    state.armor = armor;
    state.totalItems = totalItems;
    state.isFull = isFull;
    state.hasFood = hasFood;
    state.hasPickaxe = hasPickaxe;
    state.hasSword = hasSword;
  }

  function getState(): InventoryState {
    return { ...state };
  }

  function getItemCount(bot: Bot, itemName: string): number {
    return bot.inventory.items().filter((item) => item.name === itemName)
      .reduce((sum, item) => sum + item.count, 0);
  }

  function hasItem(bot: Bot, itemName: string): boolean {
    return getItemCount(bot, itemName) > 0;
  }

  return { state, update, getState, getItemCount, hasItem };
}
