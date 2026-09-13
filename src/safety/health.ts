export interface HealthCheck {
  healthy: boolean;
  health: number;
  hunger: number;
  issues: string[];
}

export function evaluateHealth(health: number, hunger: number): HealthCheck {
  const issues: string[] = [];

  if (health <= 0) {
    issues.push("Dead — cannot act");
    return { healthy: false, health, hunger, issues };
  }

  if (health < 6) {
    issues.push("Health is low — should retreat and heal");
  }

  if (health < 12) {
    issues.push("Health is moderate — avoid combat");
  }

  if (hunger <= 0) {
    issues.push("Starving — must eat immediately");
  }

  if (hunger < 6) {
    issues.push("Hunger is low — should eat soon");
  }

  return {
    healthy: issues.length === 0,
    health,
    hunger,
    issues,
  };
}

export interface RiskAssessment {
  safe: boolean;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  factors: string[];
}

export function assessRisk(params: {
  health: number;
  hunger: number;
  inventoryFull: boolean;
  nearHostile: boolean;
  lowDurability: boolean;
  nightTime: boolean;
}): RiskAssessment {
  const factors: string[] = [];
  let riskScore = 0;

  if (params.health < 6) {
    factors.push("Low health");
    riskScore += 3;
  }
  if (params.hunger < 6) {
    factors.push("Low hunger");
    riskScore += 2;
  }
  if (params.inventoryFull) {
    factors.push("Inventory full");
    riskScore += 1;
  }
  if (params.nearHostile) {
    factors.push("Hostile mob nearby");
    riskScore += 3;
  }
  if (params.lowDurability) {
    factors.push("Low tool durability");
    riskScore += 1;
  }
  if (params.nightTime) {
    factors.push("It is night");
    riskScore += 1;
  }

  let riskLevel: RiskAssessment["riskLevel"] = "none";
  if (riskScore >= 8) riskLevel = "critical";
  else if (riskScore >= 5) riskLevel = "high";
  else if (riskScore >= 3) riskLevel = "medium";
  else if (riskScore >= 1) riskLevel = "low";

  return {
    safe: riskLevel === "none" || riskLevel === "low",
    riskLevel,
    factors,
  };
}
