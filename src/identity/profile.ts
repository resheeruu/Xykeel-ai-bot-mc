import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall } from "../memory/store.js";

export interface IdentityProfile {
  username: string;
  personality: string[];
  preferences: string[];
  interests: string[];
  dislikes: string[];
  longTermAmbitions: string[];
  currentProjects: string[];
  lifeHistory: string[];
  businessPreferences: string[];
  home: { x: number; y: number; z: number } | null;
  importantLocations: Array<{ id: string; name: string; x: number; y: number; z: number }>;
  worldDiscoveries: string[];
}

export interface IdentitySystem {
  getProfile(store: MemoryStore): IdentityProfile;
  updateProfile(store: MemoryStore, updates: Partial<IdentityProfile>): MemoryStore;
  addLifeHistory(store: MemoryStore, entry: string): MemoryStore;
  addDiscovery(store: MemoryStore, discovery: string): MemoryStore;
  setCurrentProjects(store: MemoryStore, projects: string[]): MemoryStore;
  isLoaded(store: MemoryStore): boolean;
}

const DEFAULT_PROFILE: IdentityProfile = {
  username: "Xykeel",
  personality: ["curious", "helpful", "independent", "methodical"],
  preferences: ["orderly storage", "sustainable farming", "safe exploration"],
  interests: ["mining", "building", "exploring", "trading", "farming"],
  dislikes: ["wasting resources", "unnecessary risk", "chaos"],
  longTermAmbitions: [
    "establish a permanent home",
    "create sustainable food supply",
    "build a personal workshop",
    "explore the surrounding world",
    "develop economic independence",
  ],
  currentProjects: [],
  lifeHistory: [],
  businessPreferences: ["fair trades", "sustainable production"],
  home: null,
  importantLocations: [],
  worldDiscoveries: [],
};

export function createIdentitySystem(_logger: XykeelLogger): IdentitySystem {
  function getProfile(store: MemoryStore): IdentityProfile {
    const entry = recall(store, "identity", "profile");
    if (entry && typeof entry.value === "object" && entry.value !== null) {
      return { ...DEFAULT_PROFILE, ...(entry.value as Partial<IdentityProfile>) };
    }
    return { ...DEFAULT_PROFILE };
  }

  function updateProfile(store: MemoryStore, updates: Partial<IdentityProfile>): MemoryStore {
    const current = getProfile(store);
    const merged = { ...current, ...updates };
    return remember(store, "identity", "profile", merged, "critical");
  }

  function addLifeHistory(store: MemoryStore, entry: string): MemoryStore {
    const profile = getProfile(store);
    const history = [...profile.lifeHistory, entry].slice(-100);
    return updateProfile(store, { lifeHistory: history });
  }

  function addDiscovery(store: MemoryStore, discovery: string): MemoryStore {
    const profile = getProfile(store);
    const discoveries = [...profile.worldDiscoveries, discovery].slice(-50);
    return updateProfile(store, { worldDiscoveries: discoveries });
  }

  function setCurrentProjects(store: MemoryStore, projects: string[]): MemoryStore {
    return updateProfile(store, { currentProjects: projects });
  }

  function isLoaded(store: MemoryStore): boolean {
    return recall(store, "identity", "profile") !== undefined;
  }

  return { getProfile, updateProfile, addLifeHistory, addDiscovery, setCurrentProjects, isLoaded };
}
