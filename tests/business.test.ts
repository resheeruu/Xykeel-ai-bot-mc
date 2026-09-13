import { describe, it, expect } from "vitest";
import { createBusinessSystem } from "../src/business/system.js";
import { createStore } from "../src/memory/store.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

describe("Business System", () => {
  it("starts with no businesses", () => {
    const biz = createBusinessSystem(logger);
    const store = createStore();
    expect(biz.getBusinesses(store)).toEqual([]);
    expect(biz.getActiveBusiness(store)).toBeNull();
  });

  it("creates a business", () => {
    const biz = createBusinessSystem(logger);
    let store = createStore();
    store = biz.createBusiness(store, {
      id: "biz-1", name: "Xykeel's Farm Shop", type: "farm_shop",
      status: "active", location: { x: 50, y: 64, z: 50 },
      inventory: { items: [] },
      finances: { totalIncome: 0, totalExpenses: 0, balance: 0 },
      createdAt: Date.now(),
    });
    expect(biz.getBusinesses(store)).toHaveLength(1);
    expect(biz.getActiveBusiness(store)?.name).toBe("Xykeel's Farm Shop");
  });

  it("records transactions", () => {
    const biz = createBusinessSystem(logger);
    let store = createStore();
    store = biz.createBusiness(store, {
      id: "biz-1", name: "Shop", type: "general",
      status: "active", location: null,
      inventory: { items: [] },
      finances: { totalIncome: 0, totalExpenses: 0, balance: 0 },
      createdAt: Date.now(),
    });
    store = biz.recordTransaction(store, "biz-1", 100, "income");
    store = biz.recordTransaction(store, "biz-1", 30, "expense");
    const business = biz.getActiveBusiness(store);
    expect(business?.finances.balance).toBe(70);
    expect(business?.finances.totalIncome).toBe(100);
    expect(business?.finances.totalExpenses).toBe(30);
  });
});
