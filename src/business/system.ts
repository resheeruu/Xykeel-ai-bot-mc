import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export interface BusinessInfo {
  id: string;
  name: string;
  type: string;
  status: "planning" | "active" | "paused" | "closed";
  location: { x: number; y: number; z: number } | null;
  inventory: BusinessInventory;
  finances: BusinessFinances;
  createdAt: number;
}

export interface BusinessInventory {
  items: Array<{ name: string; count: number; price: number }>;
}

export interface BusinessFinances {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface BusinessSystem {
  getBusinesses(store: MemoryStore): BusinessInfo[];
  getActiveBusiness(store: MemoryStore): BusinessInfo | null;
  createBusiness(store: MemoryStore, business: BusinessInfo): MemoryStore;
  updateBusiness(store: MemoryStore, businessId: string, updates: Partial<BusinessInfo>): MemoryStore;
  recordTransaction(store: MemoryStore, businessId: string, amount: number, type: "income" | "expense"): MemoryStore;
}

export function createBusinessSystem(logger: XykeelLogger): BusinessSystem {
  function getBusinesses(store: MemoryStore): BusinessInfo[] {
    return recallCategory(store, "business").map((e) => e.value as BusinessInfo);
  }

  function getActiveBusiness(store: MemoryStore): BusinessInfo | null {
    const businesses = getBusinesses(store);
    return businesses.find((b) => b.status === "active") ?? null;
  }

  function createBusiness(store: MemoryStore, business: BusinessInfo): MemoryStore {
    logger.business(`New business: ${business.name} (${business.type})`);
    return remember(store, "business", business.id, business, "high");
  }

  function updateBusiness(store: MemoryStore, businessId: string, updates: Partial<BusinessInfo>): MemoryStore {
    const existing = recall(store, "business", businessId);
    if (!existing) return store;
    const updated = { ...(existing.value as BusinessInfo), ...updates };
    logger.business(`Business updated: ${businessId}`);
    return remember(store, "business", businessId, updated, "high");
  }

  function recordTransaction(store: MemoryStore, businessId: string, amount: number, type: "income" | "expense"): MemoryStore {
    const existing = recall(store, "business", businessId);
    if (!existing) return store;
    const business = existing.value as BusinessInfo;
    const finances = { ...business.finances };

    if (type === "income") {
      finances.totalIncome += amount;
      finances.balance += amount;
    } else {
      finances.totalExpenses += amount;
      finances.balance -= amount;
    }

    logger.business(`Transaction: ${type} $${amount} (balance: $${finances.balance})`);
    return remember(store, "business", businessId, { ...business, finances }, "high");
  }

  return { getBusinesses, getActiveBusiness, createBusiness, updateBusiness, recordTransaction };
}
