import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface GatheringSystem {
  chopTree(bot: Bot): Promise<boolean>;
  mineBlock(bot: Bot, blockName: string, count: number): Promise<boolean>;
  collectNearby(bot: Bot, itemName: string, radius: number): Promise<boolean>;
}

async function gotoPosition(bot: Bot, x: number, y: number, z: number): Promise<void> {
  const pf = await import("mineflayer-pathfinder");
  const pathfinderPlugin = pf.default ?? pf;
  bot.loadPlugin(pathfinderPlugin as unknown as Parameters<Bot["loadPlugin"]>[0]);
  const goals = (pf as unknown as { goals: { GoalBlock: new (x: number, y: number, z: number) => unknown } }).goals;
  const bf = bot as unknown as { pathfinder?: { goto: (g: unknown) => Promise<unknown> } };
  if (bf.pathfinder) {
    await bf.pathfinder.goto(new goals.GoalBlock(x, y, z));
  }
}

export function createGathering(logger: XykeelLogger): GatheringSystem {
  async function chopTree(bot: Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;

    const log = bot.findBlock({
      matching: (block) => block.name.includes("_log"),
      maxDistance: 16,
    });

    if (!log) {
      logger.action("No trees found nearby");
      return false;
    }

    try {
      await gotoPosition(bot, log.position.x, log.position.y, log.position.z);
      await bot.dig(log);
      logger.action(`Chopped ${log.name}`);
      return true;
    } catch (err) {
      logger.error(`Failed to chop tree: ${err}`);
      return false;
    }
  }

  async function mineBlock(bot: Bot, blockName: string, count: number): Promise<boolean> {
    if (!bot.entity?.position) return false;

    let mined = 0;
    for (let i = 0; i < count; i++) {
      const block = bot.findBlock({
        matching: (b) => b.name === blockName,
        maxDistance: 32,
      });

      if (!block) {
        logger.action(`No more ${blockName} found nearby (mined ${mined}/${count})`);
        break;
      }

      try {
        await gotoPosition(bot, block.position.x, block.position.y, block.position.z);
        await bot.dig(block);
        mined++;
        logger.action(`Mined ${blockName} (${mined}/${count})`);
      } catch (err) {
        logger.error(`Failed to mine ${blockName}: ${err}`);
        break;
      }
    }

    return mined > 0;
  }

  async function collectNearby(bot: Bot, itemName: string, radius: number): Promise<boolean> {
    if (!bot.entity?.position) return false;

    const pos = bot.entity.position;
    const nearbyEntities = Object.values(bot.entities).filter((entity) => {
      if (!entity.position) return false;
      return entity.position.distanceTo(pos) <= radius && entity.type === "object";
    });

    const matchingItems = nearbyEntities.filter((entity) => {
      const item = entity as unknown as { name?: string };
      return item.name === itemName;
    });

    if (matchingItems.length === 0) {
      logger.action(`No ${itemName} items found nearby`);
      return false;
    }

    let collected = 0;
    for (const item of matchingItems) {
      if (!item.position) continue;
      try {
        await gotoPosition(bot, item.position.x, item.position.y, item.position.z);
        collected++;
      } catch {
        // Skip unreachable items
      }
    }

    logger.action(`Collected ${collected} ${itemName} items`);
    return collected > 0;
  }

  return { chopTree, mineBlock, collectNearby };
}
