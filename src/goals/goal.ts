export interface Goal {
  id: string;
  description: string;
  type: "player-requested" | "xykeel-own";
  priority: number;
  status: "pending" | "active" | "completed" | "abandoned" | "blocked";
  createdAt: number;
  updatedAt: number;
  subtasks: string[];
  metadata: Record<string, unknown>;
}

export function createGoal(params: {
  description: string;
  type: Goal["type"];
  priority: number;
  subtasks?: string[];
  metadata?: Record<string, unknown>;
}): Goal {
  return {
    id: crypto.randomUUID(),
    description: params.description,
    type: params.type,
    priority: params.priority,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    subtasks: params.subtasks ?? [],
    metadata: params.metadata ?? {},
  };
}

export function prioritizeGoals(goals: Goal[]): Goal[] {
  return [...goals]
    .filter((g) => g.status === "pending" || g.status === "active")
    .sort((a, b) => {
      // player-requested goals get a small boost, but xykeel's own goals still dominate if high-priority
      const aBoost = a.type === "player-requested" ? 0.5 : 0;
      const bBoost = b.type === "player-requested" ? 0.5 : 0;
      return (b.priority + bBoost) - (a.priority + aBoost);
    });
}

export function completeGoal(goal: Goal): Goal {
  return { ...goal, status: "completed", updatedAt: Date.now() };
}

export function abandonGoal(goal: Goal): Goal {
  return { ...goal, status: "abandoned", updatedAt: Date.now() };
}
