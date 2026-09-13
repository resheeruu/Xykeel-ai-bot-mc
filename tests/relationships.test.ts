import { describe, it, expect } from "vitest";
import { createRelationshipSystem } from "../src/relationships/system.js";
import { createStore } from "../src/memory/store.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

describe("Relationship System", () => {
  it("starts with no relationships", () => {
    const rel = createRelationshipSystem(logger);
    const store = createStore();
    expect(rel.getAllRelationships(store)).toEqual([]);
    expect(rel.getRelationship(store, "uuid-1")).toBeNull();
  });

  it("records interactions and builds trust", () => {
    const rel = createRelationshipSystem(logger);
    let store = createStore();
    store = rel.recordInteraction(store, "uuid-1", "Alice", 5);
    const relationship = rel.getRelationship(store, "uuid-1");
    expect(relationship).toBeDefined();
    expect(relationship?.username).toBe("Alice");
    expect(relationship?.interactions).toBe(1);
    expect(relationship?.sentiment).toBe("friend");
  });

  it("updates sentiment over multiple interactions", () => {
    const rel = createRelationshipSystem(logger);
    let store = createStore();
    store = rel.recordInteraction(store, "uuid-1", "Alice", 8);
    store = rel.recordInteraction(store, "uuid-1", "Alice", 9);
    const relationship = rel.getRelationship(store, "uuid-1");
    expect(relationship?.interactions).toBe(2);
    expect(relationship?.trust).toBeGreaterThan(5);
  });

  it("adds notes to relationships", () => {
    const rel = createRelationshipSystem(logger);
    let store = createStore();
    store = rel.recordInteraction(store, "uuid-1", "Alice", 5);
    store = rel.addNote(store, "uuid-1", "Helped me mine diamonds");
    const relationship = rel.getRelationship(store, "uuid-1");
    expect(relationship?.notes.length).toBe(1);
    expect(relationship?.notes[0]).toContain("Helped me mine diamonds");
  });
});
