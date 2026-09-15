import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export interface ServerKnowledge {
  id: string;
  category: "server_info" | "plugin" | "command" | "teleport" | "economy" | "shop" | "claim" | "home" | "location" | "world" | "mechanic" | "danger" | "useful";
  key: string;
  value: unknown;
  confidence: number;
  source: "observation" | "chat" | "command_response" | "player_hint" | "tab_complete" | "death" | "success" | "failure";
  observedAt: number;
  lastConfirmedAt: number;
  timesObserved: number;
  verified: boolean;
  notes: string;
}

export interface EnvironmentTracker {
  record(store: MemoryStore, knowledge: Omit<ServerKnowledge, "id" | "observedAt" | "lastConfirmedAt" | "timesObserved" | "verified">): MemoryStore;
  confirm(store: MemoryStore, id: string): MemoryStore;
  get(store: MemoryStore, category: ServerKnowledge["category"], key: string): ServerKnowledge | null;
  getByCategory(store: MemoryStore, category: ServerKnowledge["category"]): ServerKnowledge[];
  getAll(store: MemoryStore): ServerKnowledge[];
  getHighConfidence(store: MemoryStore, minConfidence?: number): ServerKnowledge[];
  getUnverified(store: MemoryStore): ServerKnowledge[];
  markVerified(store: MemoryStore, id: string): MemoryStore;
  forget(store: MemoryStore, id: string): MemoryStore;
  getServerSummary(store: MemoryStore): string;
}

export function createEnvironmentTracker(logger: XykeelLogger): EnvironmentTracker {
  function record(
    store: MemoryStore,
    knowledge: Omit<ServerKnowledge, "id" | "observedAt" | "lastConfirmedAt" | "timesObserved" | "verified">
  ): MemoryStore {
    const existing = get(store, knowledge.category, knowledge.key);
    if (existing) {
      const updated: ServerKnowledge = {
        ...existing,
        value: knowledge.value,
        confidence: Math.min(1.0, existing.confidence + 0.1),
        source: knowledge.source,
        lastConfirmedAt: Date.now(),
        timesObserved: existing.timesObserved + 1,
        notes: knowledge.notes || existing.notes,
      };
      return remember(store, "env_knowledge", existing.id, updated, "medium");
    }

    const newKnowledge: ServerKnowledge = {
      ...knowledge,
      id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      observedAt: Date.now(),
      lastConfirmedAt: Date.now(),
      timesObserved: 1,
      verified: false,
    };

    logger.memory(`Server knowledge recorded: ${knowledge.category}/${knowledge.key}`);
    return remember(store, "env_knowledge", newKnowledge.id, newKnowledge, "medium");
  }

  function confirm(store: MemoryStore, id: string): MemoryStore {
    const entry = recall(store, "env_knowledge", id);
    if (!entry) return store;

    const knowledge = entry.value as ServerKnowledge;
    const updated: ServerKnowledge = {
      ...knowledge,
      confidence: Math.min(1.0, knowledge.confidence + 0.15),
      lastConfirmedAt: Date.now(),
      timesObserved: knowledge.timesObserved + 1,
    };

    return remember(store, "env_knowledge", id, updated, "low");
  }

  function get(store: MemoryStore, category: ServerKnowledge["category"], key: string): ServerKnowledge | null {
    const all = getByCategory(store, category);
    return all.find((k) => k.key === key) ?? null;
  }

  function getByCategory(store: MemoryStore, category: ServerKnowledge["category"]): ServerKnowledge[] {
    return recallCategory(store, "env_knowledge")
      .map((e) => e.value as ServerKnowledge)
      .filter((k) => k.category === category)
      .sort((a, b) => b.confidence - a.confidence);
  }

  function getAll(store: MemoryStore): ServerKnowledge[] {
    return recallCategory(store, "env_knowledge").map((e) => e.value as ServerKnowledge);
  }

  function getHighConfidence(store: MemoryStore, minConfidence: number = 0.7): ServerKnowledge[] {
    return getAll(store).filter((k) => k.confidence >= minConfidence);
  }

  function getUnverified(store: MemoryStore): ServerKnowledge[] {
    return getAll(store).filter((k) => !k.verified && k.confidence >= 0.5);
  }

  function markVerified(store: MemoryStore, id: string): MemoryStore {
    const entry = recall(store, "env_knowledge", id);
    if (!entry) return store;

    const knowledge = entry.value as ServerKnowledge;
    const updated: ServerKnowledge = {
      ...knowledge,
      verified: true,
      confidence: Math.min(1.0, knowledge.confidence + 0.2),
      lastConfirmedAt: Date.now(),
    };

    logger.memory(`Knowledge verified: ${knowledge.category}/${knowledge.key}`);
    return remember(store, "env_knowledge", id, updated, "medium");
  }

  function forget(store: MemoryStore, id: string): MemoryStore {
    const updated = { ...store };
    delete updated.entries[`env_knowledge::${id}`];
    return updated;
  }

  function getServerSummary(store: MemoryStore): string {
    const all = getAll(store);
    if (all.length === 0) return "No server knowledge yet.";

    const sections: string[] = [];

    const categories = ["server_info", "plugin", "command", "teleport", "economy", "shop", "claim", "location", "world", "mechanic", "danger", "useful"] as const;

    for (const cat of categories) {
      const items = all.filter((k) => k.category === cat && k.confidence >= 0.5);
      if (items.length === 0) continue;

      const lines = items.map((k) => `  - ${k.key}: ${JSON.stringify(k.value)} (confidence: ${k.confidence.toFixed(2)})`);
      sections.push(`${cat}:\n${lines.join("\n")}`);
    }

    return sections.join("\n\n") || "No verified server knowledge.";
  }

  return { record, confirm, get, getByCategory, getAll, getHighConfidence, getUnverified, markVerified, forget, getServerSummary };
}
