import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type MemoryImportance = "low" | "medium" | "high" | "critical";

export interface MemoryEntry {
  id: string;
  category: string;
  key: string;
  value: unknown;
  importance: MemoryImportance;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface MemoryStore {
  entries: Record<string, MemoryEntry>;
  lastSaved: number;
}

export function createStore(): MemoryStore {
  return { entries: {}, lastSaved: 0 };
}

function entryId(category: string, key: string): string {
  return `${category}::${key}`;
}

export function remember(
  store: MemoryStore,
  category: string,
  key: string,
  value: unknown,
  importance: MemoryImportance = "medium"
): MemoryStore {
  const id = entryId(category, key);
  const now = Date.now();
  const existing = store.entries[id];

  const entry: MemoryEntry = {
    id,
    category,
    key,
    value,
    importance,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    accessCount: existing?.accessCount ?? 0,
    lastAccessed: now,
  };

  return {
    ...store,
    entries: { ...store.entries, [id]: entry },
  };
}

export function recall(store: MemoryStore, category: string, key: string): MemoryEntry | undefined {
  const id = entryId(category, key);
  const entry = store.entries[id];
  if (!entry) return undefined;
  return {
    ...entry,
    accessCount: entry.accessCount + 1,
    lastAccessed: Date.now(),
  };
}

export function recallCategory(store: MemoryStore, category: string): MemoryEntry[] {
  return Object.values(store.entries)
    .filter((e) => e.category === category)
    .sort((a, b) => b.importance.localeCompare(a.importance) || b.updatedAt - a.updatedAt);
}

export function forget(store: MemoryStore, category: string, key: string): MemoryStore {
  const id = entryId(category, key);
  const { [id]: _removed, ...rest } = store.entries;
  return { ...store, entries: rest };
}

export function saveStore(store: MemoryStore, filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const data = JSON.stringify({ ...store, lastSaved: Date.now() }, null, 2);
  writeFileSync(filePath, data, "utf-8");
}

export function loadStore(filePath: string): MemoryStore {
  if (!existsSync(filePath)) return createStore();
  try {
    const data = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data) as MemoryStore;
    return { ...parsed, lastSaved: parsed.lastSaved ?? 0 };
  } catch {
    return createStore();
  }
}

export function pruneByImportance(store: MemoryStore, maxEntries: number): MemoryStore {
  const sorted = Object.values(store.entries).sort(
    (a, b) => {
      const impOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aImp = impOrder[a.importance] ?? 2;
      const bImp = impOrder[b.importance] ?? 2;
      return aImp - bImp || a.updatedAt - b.updatedAt;
    }
  );

  if (sorted.length <= maxEntries) return store;

  const keep = sorted.slice(0, maxEntries);
  const entries: Record<string, MemoryEntry> = {};
  for (const e of keep) {
    entries[e.id] = e;
  }
  return { ...store, entries };
}
