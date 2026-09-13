import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface WorldState {
  time: number;
  isDaytime: boolean;
  weather: string;
  nearbyBlocks: Array<{ name: string; distance: number }>;
  nearbyEntities: Array<{ name: string; type: string; distance: number }>;
  position: { x: number; y: number; z: number } | null;
  biome: string;
}

export interface WorldTracker {
  state: WorldState;
  update(bot: Bot): void;
  getState(): WorldState;
}

const MONITORED_BLOCKS = [
  "grass_block", "dirt", "stone", "oak_log", "spruce_log",
  "iron_ore", "gold_ore", "diamond_ore", "coal_ore",
  "water", "lava", "sand", "gravel",
  "chest", "crafting_table", "furnace",
];

export function createWorldTracker(logger: XykeelLogger): WorldTracker {
  const state: WorldState = {
    time: 0,
    isDaytime: true,
    weather: "clear",
    nearbyBlocks: [],
    nearbyEntities: [],
    position: null,
    biome: "unknown",
  };

  function update(bot: Bot): void {
    state.time = bot.time.timeOfDay;
    state.isDaytime = bot.time.timeOfDay >= 0 && bot.time.timeOfDay < 13000;
    state.weather = bot.isRaining ? "rain" : "clear";

    if (bot.entity?.position) {
      state.position = {
        x: Math.round(bot.entity.position.x),
        y: Math.round(bot.entity.position.y),
        z: Math.round(bot.entity.position.z),
      };
    }

    // Scan nearby blocks (limited range for performance)
    const nearbyBlocks: WorldState["nearbyBlocks"] = [];
    if (bot.entity?.position) {
      const pos = bot.entity.position;
      for (let dx = -4; dx <= 4; dx++) {
        for (let dy = -4; dy <= 4; dy++) {
          for (let dz = -4; dz <= 4; dz++) {
            const block = bot.blockAt(
              { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz } as Parameters<Bot["blockAt"]>[0]
            );
            if (block && MONITORED_BLOCKS.includes(block.name)) {
              nearbyBlocks.push({
                name: block.name,
                distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
              });
            }
          }
        }
      }
    }
    state.nearbyBlocks = nearbyBlocks.slice(0, 30);

    // Track nearby entities
    const nearbyEntities: WorldState["nearbyEntities"] = [];
    if (bot.entity?.position) {
      for (const [, entity] of Object.entries(bot.entities)) {
        if (!entity.position || entity === bot.entity) continue;
        const dist = bot.entity.position.distanceTo(entity.position);
        if (dist <= 32) {
          nearbyEntities.push({
            name: entity.name ?? entity.type,
            type: entity.type,
            distance: Math.round(dist * 10) / 10,
          });
        }
      }
    }
    state.nearbyEntities = nearbyEntities
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    logger.state(`Pos: ${state.position ? `${state.position.x},${state.position.y},${state.position.z}` : "unknown"}, Time: ${state.time}, Day: ${state.isDaytime}`);
  }

  function getState(): WorldState {
    return { ...state };
  }

  return { state, update, getState };
}
