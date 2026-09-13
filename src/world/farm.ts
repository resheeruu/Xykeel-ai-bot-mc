import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export interface FarmSystem {
  getFarms(store: MemoryStore): FarmInfo[];
  addFarm(store: MemoryStore, farm: FarmInfo): MemoryStore;
  updateFarm(store: MemoryStore, farmId: string, updates: Partial<FarmInfo>): MemoryStore;
}

export interface FarmInfo {
  id: string;
  name: string;
  location: { x: number; y: number; z: number };
  cropType: string;
  status: "planting" | "growing" | "ready" | "harvested";
  plantedAt: number;
}

export function createFarmSystem(logger: XykeelLogger): FarmSystem {
  function getFarms(store: MemoryStore): FarmInfo[] {
    return recallCategory(store, "farm").map((e) => e.value as FarmInfo);
  }

  function addFarm(store: MemoryStore, farm: FarmInfo): MemoryStore {
    logger.memory(`Farm registered: ${farm.name} (${farm.cropType})`);
    return remember(store, "farm", farm.id, farm, "high");
  }

  function updateFarm(store: MemoryStore, farmId: string, updates: Partial<FarmInfo>): MemoryStore {
    const existing = recall(store, "farm", farmId);
    if (!existing) return store;
    const updated = { ...(existing.value as FarmInfo), ...updates };
    logger.memory(`Farm updated: ${farmId}`);
    return remember(store, "farm", farmId, updated, "high");
  }

  return { getFarms, addFarm, updateFarm };
}
