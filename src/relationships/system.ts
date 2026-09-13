import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export interface PlayerRelationship {
  uuid: string;
  username: string;
  trust: number;
  interactions: number;
  lastInteraction: number;
  sentiment: "stranger" | "acquaintance" | "friend" | "close_friend" | "rival";
  notes: string[];
}

export interface RelationshipSystem {
  getRelationship(store: MemoryStore, playerUuid: string): PlayerRelationship | null;
  getAllRelationships(store: MemoryStore): PlayerRelationship[];
  recordInteraction(store: MemoryStore, playerUuid: string, username: string, sentiment: number): MemoryStore;
  addNote(store: MemoryStore, playerUuid: string, note: string): MemoryStore;
}

export function createRelationshipSystem(logger: XykeelLogger): RelationshipSystem {
  function getRelationship(store: MemoryStore, playerUuid: string): PlayerRelationship | null {
    const entry = recall(store, "relationship", playerUuid);
    if (!entry) return null;
    return entry.value as PlayerRelationship;
  }

  function getAllRelationships(store: MemoryStore): PlayerRelationship[] {
    return recallCategory(store, "relationship").map((e) => e.value as PlayerRelationship);
  }

  function recordInteraction(store: MemoryStore, playerUuid: string, username: string, sentiment: number): MemoryStore {
    const existing = getRelationship(store, playerUuid);
    const now = Date.now();

    if (!existing) {
      const newRel: PlayerRelationship = {
        uuid: playerUuid,
        username,
        trust: sentiment,
        interactions: 1,
        lastInteraction: now,
        sentiment: sentimentToLevel(sentiment),
        notes: [],
      };
      logger.memory(`New relationship: ${username} (trust: ${sentiment})`);
      return remember(store, "relationship", playerUuid, newRel, "medium");
    }

    const updatedTrust = (existing.trust * existing.interactions + sentiment) / (existing.interactions + 1);
    const updated: PlayerRelationship = {
      ...existing,
      trust: Math.round(updatedTrust * 10) / 10,
      interactions: existing.interactions + 1,
      lastInteraction: now,
      sentiment: sentimentToLevel(updatedTrust),
    };

    return remember(store, "relationship", playerUuid, updated, "medium");
  }

  function addNote(store: MemoryStore, playerUuid: string, note: string): MemoryStore {
    const existing = getRelationship(store, playerUuid);
    if (!existing) return store;

    const updated: PlayerRelationship = {
      ...existing,
      notes: [...existing.notes.slice(-20), `${new Date().toISOString()}: ${note}`],
    };

    logger.memory(`Note added for ${existing.username}: ${note}`);
    return remember(store, "relationship", playerUuid, updated, "medium");
  }

  function sentimentToLevel(trust: number): PlayerRelationship["sentiment"] {
    if (trust >= 8) return "close_friend";
    if (trust >= 5) return "friend";
    if (trust >= 2) return "acquaintance";
    if (trust >= 0) return "stranger";
    return "rival";
  }

  return { getRelationship, getAllRelationships, recordInteraction, addNote };
}
