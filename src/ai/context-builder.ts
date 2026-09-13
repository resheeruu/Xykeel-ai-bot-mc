import type { IdentityProfile } from "../identity/profile.js";
import type { Goal } from "../goals/goal.js";
import type { Plan } from "../autonomy/planner.js";

const MAX_CONTEXT_CHARS = 2000;

export interface BotContextForAI {
  username: string;
  health: number;
  hunger: number;
  position: { x: number; y: number; z: number } | null;
  biome: string | null;
  isDaytime: boolean;
  currentGoal: Goal | null;
  currentPlan: Plan | null;
  currentActivity: string;
  inventorySummary: string;
  nearbyPlayers: string[];
  dangerLevel: string;
  recentEvents: string[];
  identity: IdentityProfile | null;
}

export function buildContext(ctx: BotContextForAI): string {
  const parts: string[] = [];

  parts.push(`You are ${ctx.username}, an independent Minecraft bot.`);
  parts.push(`HP: ${ctx.health}/20, Food: ${ctx.hunger}/20`);

  if (ctx.position) {
    parts.push(`Position: (${Math.round(ctx.position.x)}, ${Math.round(ctx.position.y)}, ${Math.round(ctx.position.z)})`);
  }
  if (ctx.biome) parts.push(`Biome: ${ctx.biome}`);
  parts.push(`Time: ${ctx.isDaytime ? "day" : "night"}`);

  if (ctx.currentGoal) {
    parts.push(`Current goal: ${ctx.currentGoal.description} (priority ${ctx.currentGoal.priority})`);
  }
  if (ctx.currentPlan && ctx.currentPlan.actions.length > 0) {
    const action = ctx.currentPlan.actions[0];
    parts.push(`Executing: ${action.description}`);
  }

  if (ctx.inventorySummary) parts.push(`Inventory: ${ctx.inventorySummary}`);

  if (ctx.nearbyPlayers.length > 0) {
    parts.push(`Nearby players: ${ctx.nearbyPlayers.join(", ")}`);
  }

  if (ctx.dangerLevel !== "safe") {
    parts.push(`DANGER: ${ctx.dangerLevel}`);
  }

  if (ctx.identity) {
    const id = ctx.identity;
    if (id.personality.length > 0) parts.push(`Personality: ${id.personality.join(", ")}`);
    if (id.interests.length > 0) parts.push(`Interests: ${id.interests.join(", ")}`);
    if (id.currentProjects.length > 0) parts.push(`Projects: ${id.currentProjects.join("; ")}`);
  }

  if (ctx.recentEvents.length > 0) {
    parts.push(`Recent events: ${ctx.recentEvents.slice(-5).join("; ")}`);
  }

  const full = parts.join("\n");
  if (full.length > MAX_CONTEXT_CHARS) {
    return full.slice(0, MAX_CONTEXT_CHARS);
  }
  return full;
}

export function summarizeInventory(
  items: Array<{ name: string; count: number }>
): string {
  if (items.length === 0) return "empty";
  const categories: Record<string, number> = {};
  for (const item of items) {
    const cat = categorizeItem(item.name);
    categories[cat] = (categories[cat] ?? 0) + item.count;
  }
  return Object.entries(categories)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(", ");
}

function categorizeItem(name: string): string {
  if (name.includes("pickaxe")) return "pickaxes";
  if (name.includes("sword")) return "swords";
  if (name.includes("axe")) return "axes";
  if (name.includes("hoe")) return "hoes";
  if (name.includes("_log")) return "wood";
  if (name.includes("cobblestone") || name.includes("stone")) return "stone";
  if (name.includes("iron")) return "iron";
  if (name.includes("gold")) return "gold";
  if (name.includes("diamond")) return "diamond";
  if (name.includes("bread") || name.includes("cooked") || name.includes("food")) return "food";
  if (name.includes("seed")) return "seeds";
  if (name.includes("dirt") || name.includes("grass")) return "dirt";
  if (name.includes("plank")) return "planks";
  return "misc";
}
