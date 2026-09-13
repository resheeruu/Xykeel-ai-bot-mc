import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall } from "../memory/store.js";

export interface HomeSystem {
  getHomeLocation(store: MemoryStore): { x: number; y: number; z: number } | null;
  setHomeLocation(store: MemoryStore, x: number, y: number, z: number): MemoryStore;
  hasHome(store: MemoryStore): boolean;
}

export function createHomeSystem(logger: XykeelLogger): HomeSystem {
  function getHomeLocation(store: MemoryStore): { x: number; y: number; z: number } | null {
    const entry = recall(store, "location", "home");
    if (!entry) return null;
    return entry.value as { x: number; y: number; z: number };
  }

  function setHomeLocation(store: MemoryStore, x: number, y: number, z: number): MemoryStore {
    logger.memory(`Home set to ${x}, ${y}, ${z}`);
    return remember(store, "location", "home", { x, y, z }, "critical");
  }

  function hasHome(store: MemoryStore): boolean {
    return recall(store, "location", "home") !== undefined;
  }

  return { getHomeLocation, setHomeLocation, hasHome };
}
