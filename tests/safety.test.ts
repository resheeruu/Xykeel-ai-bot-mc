import { describe, it, expect } from "vitest";
import { evaluateHealth, assessRisk } from "../src/safety/health.js";

describe("Safety — Health", () => {
  it("full health is healthy", () => {
    const check = evaluateHealth(20, 20);
    expect(check.healthy).toBe(true);
    expect(check.issues).toEqual([]);
  });

  it("low health is not healthy", () => {
    const check = evaluateHealth(3, 15);
    expect(check.healthy).toBe(false);
    expect(check.issues.length).toBeGreaterThan(0);
  });

  it("dead is not healthy", () => {
    const check = evaluateHealth(0, 10);
    expect(check.healthy).toBe(false);
    expect(check.issues[0]).toContain("Dead");
  });

  it("low hunger is flagged", () => {
    const check = evaluateHealth(20, 4);
    expect(check.healthy).toBe(false);
    expect(check.issues.some((i) => i.toLowerCase().includes("hunger"))).toBe(true);
  });
});

describe("Safety — Risk Assessment", () => {
  it("no risks is safe", () => {
    const risk = assessRisk({
      health: 20,
      hunger: 20,
      inventoryFull: false,
      nearHostile: false,
      lowDurability: false,
      nightTime: false,
    });
    expect(risk.safe).toBe(true);
    expect(risk.riskLevel).toBe("none");
  });

  it("multiple risks escalate", () => {
    const risk = assessRisk({
      health: 3,
      hunger: 2,
      inventoryFull: true,
      nearHostile: true,
      lowDurability: false,
      nightTime: true,
    });
    expect(risk.safe).toBe(false);
    expect(["high", "critical"]).toContain(risk.riskLevel);
    expect(risk.factors.length).toBeGreaterThan(2);
  });

  it("night alone is low risk", () => {
    const risk = assessRisk({
      health: 20,
      hunger: 20,
      inventoryFull: false,
      nearHostile: false,
      lowDurability: false,
      nightTime: true,
    });
    expect(risk.safe).toBe(true);
    expect(risk.riskLevel).toBe("low");
  });
});
