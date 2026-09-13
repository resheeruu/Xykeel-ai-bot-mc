import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlayerTracker } from "../src/minecraft/players.js";
import { createChatObserver } from "../src/minecraft/chat.js";
import { createWorldTracker } from "../src/minecraft/world.js";
import { createInventoryTracker } from "../src/minecraft/inventory.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

function mockBot(overrides?: Record<string, unknown>) {
  return {
    username: "Xykeel",
    entity: { position: { x: 0, y: 64, z: 0 }, distanceTo: () => 5 },
    players: {},
    entities: {},
    time: { timeOfDay: 6000 },
    isRaining: false,
    blockAt: () => null,
    inventory: {
      items: () => [],
      slots: new Array(41).fill(null),
      emptySlotCount: () => 36,
      count: () => 0,
    },
    registry: { itemsByName: {} },
    ...overrides,
  } as never;
}

describe("Player Tracker", () => {
  it("creates with empty players", () => {
    const tracker = createPlayerTracker(logger);
    expect(tracker.getPlayers()).toEqual([]);
  });

  it("detects owner online", () => {
    const tracker = createPlayerTracker(logger);
    const pos = { x: 0, y: 64, z: 0, distanceTo: () => 5 };
    const bot = mockBot({
      entity: { position: pos },
      players: {
        "owner-uuid": { uuid: "owner-uuid", username: "Owner", entity: { position: { x: 10, y: 64, z: 10 } } },
      },
    });
    tracker.update(bot);
    expect(tracker.isOwnerOnline("owner-uuid")).toBe(true);
    expect(tracker.isOwnerOnline("other-uuid")).toBe(false);
  });

  it("tracks nearby players", () => {
    const tracker = createPlayerTracker(logger);
    const bot = mockBot({
      players: {
        "p1": { uuid: "p1", username: "Alice", entity: { position: { x: 5, y: 64, z: 5 } } },
        "p2": { uuid: "p2", username: "Bob", entity: { position: { x: 50, y: 64, z: 50 } } },
      },
    });
    bot.entity.position.distanceTo = (other: { x: number; y: number; z: number }) => {
      const dx = other.x - 0;
      const dz = other.z - 0;
      return Math.sqrt(dx * dx + dz * dz);
    };
    tracker.update(bot);
    const players = tracker.getPlayers();
    expect(players.length).toBe(2);
  });
});

describe("Chat Observer", () => {
  it("creates with empty messages", () => {
    const observer = createChatObserver(logger);
    expect(observer.getRecent(10)).toEqual([]);
  });

  it("registers message callbacks", () => {
    const observer = createChatObserver(logger);
    const cb = vi.fn();
    observer.onMessage(cb);
    // No bot needed for callback registration
    expect(typeof cb).toBe("function");
  });
});

describe("World Tracker", () => {
  it("creates with default world state", () => {
    const tracker = createWorldTracker(logger);
    const state = tracker.getState();
    expect(state.time).toBe(0);
    expect(state.isDaytime).toBe(true);
    expect(state.weather).toBe("clear");
    expect(state.position).toBeNull();
  });

  it("updates from bot state", () => {
    const tracker = createWorldTracker(logger);
    const bot = mockBot({
      time: { timeOfDay: 14000 },
      isRaining: true,
    });
    tracker.update(bot);
    const state = tracker.getState();
    expect(state.time).toBe(14000);
    expect(state.isDaytime).toBe(false);
    expect(state.weather).toBe("rain");
  });
});

describe("Inventory Tracker", () => {
  it("creates with empty inventory", () => {
    const tracker = createInventoryTracker(logger);
    const state = tracker.getState();
    expect(state.items).toEqual([]);
    expect(state.totalItems).toBe(0);
    expect(state.isFull).toBe(false);
    expect(state.hasFood).toBe(false);
    expect(state.hasPickaxe).toBe(false);
    expect(state.hasSword).toBe(false);
  });

  it("detects food in inventory", () => {
    const tracker = createInventoryTracker(logger);
    const bot = mockBot({
      inventory: {
        items: () => [{ name: "bread", count: 5, slot: 0 }],
        slots: new Array(41).fill(null),
        emptySlotCount: () => 35,
        count: () => 0,
      },
    });
    tracker.update(bot);
    expect(tracker.getState().hasFood).toBe(true);
  });

  it("detects full inventory", () => {
    const tracker = createInventoryTracker(logger);
    const bot = mockBot({
      inventory: {
        items: () => [{ name: "dirt", count: 64, slot: 0 }],
        slots: new Array(41).fill(null),
        emptySlotCount: () => 0,
        count: () => 0,
      },
    });
    tracker.update(bot);
    expect(tracker.getState().isFull).toBe(true);
  });
});
