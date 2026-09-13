import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recallCategory } from "../memory/store.js";

export interface LocationInfo {
  id: string;
  name: string;
  category: "home" | "mine" | "farm" | "shop" | "landmark" | "resource" | "danger";
  location: { x: number; y: number; z: number };
  notes: string;
  discoveredAt: number;
}

export interface LocationTracker {
  getLocations(store: MemoryStore): LocationInfo[];
  getLocationsByCategory(store: MemoryStore, category: LocationInfo["category"]): LocationInfo[];
  addLocation(store: MemoryStore, location: LocationInfo): MemoryStore;
  removeLocation(store: MemoryStore, locationId: string): MemoryStore;
}

export function createLocationTracker(logger: XykeelLogger): LocationTracker {
  function getLocations(store: MemoryStore): LocationInfo[] {
    return recallCategory(store, "location_registry").map((e) => e.value as LocationInfo);
  }

  function getLocationsByCategory(store: MemoryStore, category: LocationInfo["category"]): LocationInfo[] {
    return getLocations(store).filter((l) => l.category === category);
  }

  function addLocation(store: MemoryStore, location: LocationInfo): MemoryStore {
    logger.memory(`Location registered: ${location.name} (${location.category})`);
    return remember(store, "location_registry", location.id, location, "medium");
  }

  function removeLocation(store: MemoryStore, locationId: string): MemoryStore {
    logger.memory(`Location removed: ${locationId}`);
    const updated = { ...store };
    delete updated.entries[`location_registry::${locationId}`];
    return updated;
  }

  return { getLocations, getLocationsByCategory, addLocation, removeLocation };
}
