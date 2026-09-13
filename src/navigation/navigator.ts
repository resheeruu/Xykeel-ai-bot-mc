import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";
import { goals } from "mineflayer-pathfinder";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface NavigationSystem {
  moveTo(bot: Bot, target: Position, timeoutMs?: number): Promise<boolean>;
  moveAway(bot: Bot, distance: number, timeoutMs?: number): Promise<boolean>;
  getPath(bot: Bot, from: Position, to: Position): Position[];
  getCurrentPosition(bot: Bot): Position | null;
  distanceTo(a: Position, b: Position): number;
  initMovements(bot: Bot): void;
  cancelCurrent(): void;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const STUCK_CHECK_INTERVAL_MS = 3_000;
const STUCK_THRESHOLD = 0.1;

export function createNavigation(logger: XykeelLogger): NavigationSystem {
  let currentAbort: AbortController | null = null;
  let movementsInitialized = new WeakSet<object>();

  function initMovements(bot: Bot): void {
    if (movementsInitialized.has(bot)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mcData = require("minecraft-data")(bot.version);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Movements = require("mineflayer-pathfinder").Movements;
      const mov = new Movements(bot, mcData);
      bot.pathfinder.setMovements(mov);
      movementsInitialized.add(bot);
      logger.action("Pathfinder movements initialized");
    } catch {
      logger.error("Failed to initialize pathfinder movements");
    }
  }

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

  function cancelCurrent(): void {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
      logger.action("Navigation cancelled");
    }
  }

  async function moveTo(
    bot: Bot,
    target: Position,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<boolean> {
    cancelCurrent();
    const abort = new AbortController();
    currentAbort = abort;

    initMovements(bot);

    const goal = new goals.GoalBlock(target.x, target.y, target.z);
    let completed = false;
    let lastPos = bot.entity?.position?.clone() ?? null;
    let stuckSince = 0;

    const timeoutPromise = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        if (!completed) {
          logger.error(`Navigation to ${target.x},${target.y},${target.z} timed out`);
          try { bot.pathfinder.setGoal(null); } catch { /* ignore */ }
          resolve(false);
        }
      }, timeoutMs);

      abort.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        try { bot.pathfinder.setGoal(null); } catch { /* ignore */ }
        if (!completed) resolve(false);
      });
    });

    const movePromise = new Promise<boolean>((resolve) => {
      const onGoalReached = () => {
        completed = true;
        cleanup();
        logger.action(`Reached ${target.x},${target.y},${target.z}`);
        resolve(true);
      };

      const onGoalUpdated = () => {
        // Goal recalculation — not an error
      };

      const onPathUpdate = (reason: { status?: string }) => {
        if (reason?.status === "noPath") {
          completed = true;
          cleanup();
          logger.error(`No path to ${target.x},${target.y},${target.z}`);
          resolve(false);
        }
      };

      const cleanup = () => {
        bot.removeListener("goal_reached", onGoalReached);
        bot.removeListener("goal_updated", onGoalUpdated);
        bot.removeListener("path_update", onPathUpdate);
        if (stuckInterval) clearInterval(stuckInterval);
      };

      // Stuck detection
      const stuckInterval = setInterval(() => {
        if (completed) { clearInterval(stuckInterval); return; }
        const pos = bot.entity?.position;
        if (!pos || !lastPos) { lastPos = pos?.clone() ?? null; return; }

        const moved = pos.distanceTo(lastPos);
        if (moved < STUCK_THRESHOLD) {
          if (stuckSince === 0) stuckSince = Date.now();
          else if (Date.now() - stuckSince > 10_000) {
            completed = true;
            cleanup();
            logger.error(`Stuck for 10s navigating to ${target.x},${target.y},${target.z}`);
            resolve(false);
          }
        } else {
          stuckSince = 0;
        }
        lastPos = pos.clone();
      }, STUCK_CHECK_INTERVAL_MS);

      bot.on("goal_reached", onGoalReached);
      bot.on("goal_updated", onGoalUpdated);
      bot.on("path_update", onPathUpdate);

      try {
        bot.pathfinder.setGoal(goal);
      } catch (err) {
        completed = true;
        cleanup();
        logger.error(`Failed to set pathfinder goal: ${err}`);
        resolve(false);
      }
    });

    const result = await Promise.race([movePromise, timeoutPromise]);
    currentAbort = null;
    return result;
  }

  async function moveAway(
    bot: Bot,
    distance: number,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<boolean> {
    if (!bot.entity?.position) return false;
    const pos = bot.entity.position;
    const angle = Math.random() * Math.PI * 2;
    const target: Position = {
      x: Math.round(pos.x + Math.cos(angle) * distance),
      y: Math.round(pos.y),
      z: Math.round(pos.z + Math.sin(angle) * distance),
    };
    return moveTo(bot, target, timeoutMs);
  }

  function getPath(_bot: Bot, _from: Position, to: Position): Position[] {
    return [to];
  }

  return { moveTo, moveAway, getPath, getCurrentPosition, distanceTo, initMovements, cancelCurrent };
}
