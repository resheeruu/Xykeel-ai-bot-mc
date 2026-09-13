import { describe, it, expect } from "vitest";
import {
  createStore,
  remember,
  recall,
  recallCategory,
  forget,
  pruneByImportance,
} from "../src/memory/store.js";

describe("Memory Store", () => {
  it("creates empty store", () => {
    const store = createStore();
    expect(Object.keys(store.entries)).toHaveLength(0);
  });

  it("remembers and recalls", () => {
    let store = createStore();
    store = remember(store, "location", "home", { x: 100, y: 64, z: 200 }, "high");
    const entry = recall(store, "location", "home");
    expect(entry).toBeDefined();
    expect(entry?.value).toEqual({ x: 100, y: 64, z: 200 });
    expect(entry?.importance).toBe("high");
  });

  it("returns undefined for unknown recall", () => {
    const store = createStore();
    expect(recall(store, "nonexistent", "key")).toBeUndefined();
  });

  it("recalls by category", () => {
    let store = createStore();
    store = remember(store, "location", "home", { x: 0, y: 0, z: 0 });
    store = remember(store, "location", "mine", { x: 10, y: -10, z: 5 });
    store = remember(store, "relationship", "alice", { trust: 5 });
    const locations = recallCategory(store, "location");
    expect(locations).toHaveLength(2);
  });

  it("forgets an entry", () => {
    let store = createStore();
    store = remember(store, "test", "key", "value");
    store = forget(store, "test", "key");
    expect(recall(store, "test", "key")).toBeUndefined();
  });

  it("prunes low-importance entries when over limit", () => {
    let store = createStore();
    store = remember(store, "c", "low1", "v", "low");
    store = remember(store, "c", "low2", "v", "low");
    store = remember(store, "c", "high1", "v", "high");
    store = remember(store, "c", "crit1", "v", "critical");
    const pruned = pruneByImportance(store, 2);
    expect(Object.keys(pruned.entries)).toHaveLength(2);
    expect(pruned.entries["c::crit1"]).toBeDefined();
    expect(pruned.entries["c::high1"]).toBeDefined();
  });
});
