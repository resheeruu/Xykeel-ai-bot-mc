import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface NavigationSystem {
  moveTo(target: Position): Promise<boolean>;
  moveAway(distance: number): Promise<boolean>;
  getPath(from: Position, to: Position): Position[];
  getCurrentPosition(bot: Bot): Position | null;
  distanceTo(a: Position, b: Position): number;
}

export function createNavigation(logger: XykeelLogger): NavigationSystem {
  function getCurrentPosition(bot: Bot): Position | null {
    if (!bot.entity?.position) return null;
    return {
      x: Math.round(bot.entity.position.x),
      y: Math.round(bot.entity.position.y),
      z: Math.round(bot.entity.position.z),
    };
  }

  function distanceTo(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  async function moveTo(target: Position): Promise<boolean> {
    logger.action(`Moving to ${target.x}, ${target.y}, ${target.z}`);
    // Phase 3: Basic implementation — will use mineflayer-pathfinder in Phase 3+
    // For now, return true as a placeholder until pathfinder is integrated
    logger.action(`Navigation to ${target.x},${target.y},${target.z} — pathfinder not yet integrated`);
    return false;
  }

  async function moveAway(distance: number): Promise<boolean> {
    logger.action(`Moving away ${distance} blocks`);
    return false;
  }

  function getPath(_from: Position, to: Position): Position[] {
    // Placeholder — will be replaced with A* or mineflayer-pathfinder
    return [to];
  }

  return { moveTo, moveAway, getPath, getCurrentPosition, distanceTo };
}
