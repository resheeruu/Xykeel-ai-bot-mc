import { describe, it, expect } from "vitest";
import { createHomeSystem } from "../src/world/home.js";
import { createFarmSystem } from "../src/world/farm.js";
import { createLocationTracker } from "../src/world/locations.js";
import { createStore } from "../src/memory/store.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

describe("Home System", () => {
  it("starts with no home", () => {
    const home = createHomeSystem(logger);
    const store = createStore();
    expect(home.hasHome(store)).toBe(false);
    expect(home.getHomeLocation(store)).toBeNull();
  });

  it("sets and retrieves home", () => {
    const home = createHomeSystem(logger);
    let store = createStore();
    store = home.setHomeLocation(store, 100, 64, 200);
    expect(home.hasHome(store)).toBe(true);
    expect(home.getHomeLocation(store)).toEqual({ x: 100, y: 64, z: 200 });
  });
});

describe("Farm System", () => {
  it("starts with no farms", () => {
    const farm = createFarmSystem(logger);
    const store = createStore();
    expect(farm.getFarms(store)).toEqual([]);
  });

  it("adds and retrieves farms", () => {
    const farm = createFarmSystem(logger);
    let store = createStore();
    store = farm.addFarm(store, {
      id: "farm-1", name: "Wheat Field", location: { x: 50, y: 64, z: 50 },
      cropType: "wheat", status: "planting", plantedAt: Date.now(),
    });
    expect(farm.getFarms(store)).toHaveLength(1);
    expect(farm.getFarms(store)[0].name).toBe("Wheat Field");
  });

  it("updates farm status", () => {
    const farm = createFarmSystem(logger);
    let store = createStore();
    store = farm.addFarm(store, {
      id: "farm-1", name: "Wheat Field", location: { x: 50, y: 64, z: 50 },
      cropType: "wheat", status: "planting", plantedAt: Date.now(),
    });
    store = farm.updateFarm(store, "farm-1", { status: "growing" });
    expect(farm.getFarms(store)[0].status).toBe("growing");
  });
});

describe("Location Tracker", () => {
  it("starts with no locations", () => {
    const tracker = createLocationTracker(logger);
    const store = createStore();
    expect(tracker.getLocations(store)).toEqual([]);
  });

  it("adds locations by category", () => {
    const tracker = createLocationTracker(logger);
    let store = createStore();
    store = tracker.addLocation(store, {
      id: "loc-1", name: "Spawn", category: "landmark",
      location: { x: 0, y: 64, z: 0 }, notes: "Server spawn", discoveredAt: Date.now(),
    });
    store = tracker.addLocation(store, {
      id: "loc-2", name: "Iron Mine", category: "mine",
      location: { x: 100, y: 30, z: 50 }, notes: "Rich iron", discoveredAt: Date.now(),
    });
    expect(tracker.getLocations(store)).toHaveLength(2);
    expect(tracker.getLocationsByCategory(store, "mine")).toHaveLength(1);
  });
});
