import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface PlayerInfo {
  uuid: string;
  username: string;
  distance: number;
  lastSeen: number;
}

export interface PlayerTracker {
  players: Map<string, PlayerInfo>;
  update(bot: Bot): void;
  getPlayers(): PlayerInfo[];
  isOwnerOnline(ownerUuid: string): boolean;
  getNearestPlayer(ownerUuid: string): PlayerInfo | null;
}

export function createPlayerTracker(_logger: XykeelLogger): PlayerTracker {
  const players = new Map<string, PlayerInfo>();

  function update(bot: Bot): void {
    const now = Date.now();
    const observed = new Set<string>();

    for (const [, mfPlayer] of Object.entries(bot.players)) {
      if (!mfPlayer.uuid || mfPlayer.username === bot.username) continue;

      const uuid = mfPlayer.uuid;
      const distance = mfPlayer.entity
        ? bot.entity.position.distanceTo(mfPlayer.entity.position)
        : Infinity;

      players.set(uuid, {
        uuid,
        username: mfPlayer.username,
        distance,
        lastSeen: now,
      });
      observed.add(uuid);
    }

    for (const [uuid, info] of players) {
      if (!observed.has(uuid) && now - info.lastSeen > 300_000) {
        players.delete(uuid);
      }
    }
  }

  function getPlayers(): PlayerInfo[] {
    return Array.from(players.values());
  }

  function isOwnerOnline(ownerUuid: string): boolean {
    return players.has(ownerUuid);
  }

  function getNearestPlayer(ownerUuid: string): PlayerInfo | null {
    let nearest: PlayerInfo | null = null;
    for (const player of players.values()) {
      if (player.uuid === ownerUuid) continue;
      if (!nearest || player.distance < nearest.distance) {
        nearest = player;
      }
    }
    return nearest;
  }

  return { players, update, getPlayers, isOwnerOnline, getNearestPlayer };
}
