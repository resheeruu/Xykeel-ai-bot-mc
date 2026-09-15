import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export type LifePhase =
  | "SURVIVE"
  | "ESTABLISH"
  | "EQUIP"
  | "MASTER"
  | "EXPAND"
  | "COMPETE"
  | "BUILD"
  | "TRADE"
  | "DEFEND"
  | "LONG-TERM_LEGACY";

export interface Project {
  id: string;
  name: string;
  description: string;
  phase: LifePhase;
  status: "planned" | "active" | "completed" | "blocked" | "abandoned";
  tasks: ProjectTask[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface ProjectTask {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "skipped";
  required: boolean;
  blockers: string[];
  result: string;
  createdAt: number;
  completedAt: number | null;
}

export interface GoalDecomposer {
  getCurrentPhase(store: MemoryStore): LifePhase;
  advancePhase(store: MemoryStore, phase: LifePhase): MemoryStore;
  createProject(store: MemoryStore, project: Omit<Project, "id" | "createdAt" | "updatedAt" | "completedAt">): MemoryStore;
  getProject(store: MemoryStore, projectId: string): Project | null;
  getProjectsByPhase(store: MemoryStore, phase: LifePhase): Project[];
  getActiveProjects(store: MemoryStore): Project[];
  updateTask(store: MemoryStore, projectId: string, taskId: string, updates: Partial<ProjectTask>): MemoryStore;
  completeProject(store: MemoryStore, projectId: string): MemoryStore;
  getNextTask(store: MemoryStore, projectId: string): ProjectTask | null;
  shouldAdvancePhase(store: MemoryStore): { shouldAdvance: boolean; nextPhase: LifePhase | null };
  getPhaseProgress(store: MemoryStore, phase: LifePhase): { total: number; completed: number; percentage: number };
}

const PHASE_ORDER: LifePhase[] = [
  "SURVIVE", "ESTABLISH", "EQUIP", "MASTER", "EXPAND",
  "COMPETE", "BUILD", "TRADE", "DEFEND", "LONG-TERM_LEGACY",
];

const PHASE_PROJECT_TEMPLATES: Record<LifePhase, Array<{ name: string; description: string; tasks: string[] }>> = {
  SURVIVE: [
    {
      name: "Basic Survival",
      description: "Ensure immediate survival needs are met",
      tasks: [
        "Find or craft food",
        "Secure shelter for the night",
        "Establish basic lighting",
        "Avoid hostile mobs",
      ],
    },
  ],
  ESTABLISH: [
    {
      name: "Home Base",
      description: "Establish a permanent home location",
      tasks: [
        "Find suitable location",
        "Build basic shelter",
        "Place bed for spawn point",
        "Set up basic storage",
        "Light surrounding area",
      ],
    },
    {
      name: "Food Supply",
      description: "Create sustainable food production",
      tasks: [
        "Gather seeds from grass",
        "Till soil near water",
        "Plant initial crops",
        "Set up basic farm layout",
        "Build crop storage",
      ],
    },
  ],
  EQUIP: [
    {
      name: "Iron Tools",
      description: "Upgrade to iron equipment",
      tasks: [
        "Mine cobblestone for furnace",
        "Smelt iron ore",
        "Craft iron pickaxe",
        "Craft iron sword",
        "Craft iron armor pieces",
      ],
    },
    {
      name: "Diamond Gear",
      description: "Obtain diamond equipment",
      tasks: [
        "Prepare adequate food supply",
        "Prepare torches and supplies",
        "Mine to diamond level",
        "Locate diamond ore",
        "Mine diamonds safely",
        "Craft diamond pickaxe",
        "Craft diamond sword",
        "Craft diamond armor",
      ],
    },
  ],
  MASTER: [
    {
      name: "Enchantment System",
      description: "Set up enchanting capabilities",
      tasks: [
        "Obtain lapis lazuli",
        "Craft or find enchanting table",
        "Build bookshelf collection",
        "Set up enchanting room",
      ],
    },
    {
      name: "Brewing",
      description: "Establish potion brewing",
      tasks: [
        "Enter Nether safely",
        "Locate Nether fortress",
        "Obtain blaze rods",
        "Craft brewing stand",
        "Brew basic potions",
      ],
    },
  ],
  EXPAND: [
    {
      name: "Nether Infrastructure",
      description: "Establish Nether presence",
      tasks: [
        "Build safe Nether portal",
        "Light portal in Nether",
        "Mark portal location",
        "Establish Nether route",
        "Locate key Nether resources",
      ],
    },
    {
      name: "Resource Expansion",
      description: "Expand resource gathering capabilities",
      tasks: [
        "Set up automated farms",
        "Expand mining operations",
        "Establish tree farm",
        "Build animal pen",
      ],
    },
  ],
  COMPETE: [
    {
      name: "PvP Readiness",
      description: "Prepare for player competition",
      tasks: [
        "Obtain best available armor",
        "Enchant PvP gear",
        "Stockpile golden apples",
        "Practice combat techniques",
      ],
    },
  ],
  BUILD: [
    {
      name: "Grand Structure",
      description: "Construct a significant build project",
      tasks: [
        "Design structure plan",
        "Gather building materials",
        "Lay foundation",
        "Build main structure",
        "Add interior details",
        "Light and decorate",
      ],
    },
  ],
  TRADE: [
    {
      name: "Economic System",
      description: "Establish trading and economy",
      tasks: [
        "Set up shop location",
        "Price items fairly",
        "Advertise services",
        "Build trade relationships",
        "Manage inventory",
      ],
    },
  ],
  DEFEND: [
    {
      name: "Base Defense",
      description: "Protect home and resources",
      tasks: [
        "Build defensive walls",
        "Light all areas",
        "Set up warning systems",
        "Create escape routes",
        "Store backup supplies",
      ],
    },
  ],
  "LONG-TERM_LEGACY": [
    {
      name: "Legacy Project",
      description: "Create lasting impact on the server",
      tasks: [
        "Identify unique contribution",
        "Plan large-scale project",
        "Gather community support",
        "Execute construction",
        "Document and share",
      ],
    },
  ],
};

export function createGoalDecomposer(logger: XykeelLogger): GoalDecomposer {
  function getCurrentPhase(store: MemoryStore): LifePhase {
    const entry = recall(store, "life_progress", "current_phase");
    if (entry && typeof entry.value === "string") {
      return entry.value as LifePhase;
    }
    return "SURVIVE";
  }

  function advancePhase(store: MemoryStore, phase: LifePhase): MemoryStore {
    logger.system(`Advancing life phase to: ${phase}`);
    return remember(store, "life_progress", "current_phase", phase, "critical");
  }

  function createProject(
    store: MemoryStore,
    project: Omit<Project, "id" | "createdAt" | "updatedAt" | "completedAt">
  ): MemoryStore {
    const fullProject: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };
    logger.goal(`Project created: ${fullProject.name} (phase: ${fullProject.phase})`);
    return remember(store, "project", fullProject.id, fullProject, "high");
  }

  function getProject(store: MemoryStore, projectId: string): Project | null {
    const entry = recall(store, "project", projectId);
    if (!entry) return null;
    return entry.value as Project;
  }

  function getProjectsByPhase(store: MemoryStore, phase: LifePhase): Project[] {
    return recallCategory(store, "project")
      .map((e) => e.value as Project)
      .filter((p) => p.phase === phase);
  }

  function getActiveProjects(store: MemoryStore): Project[] {
    return recallCategory(store, "project")
      .map((e) => e.value as Project)
      .filter((p) => p.status === "active" || p.status === "planned");
  }

  function updateTask(
    store: MemoryStore,
    projectId: string,
    taskId: string,
    updates: Partial<ProjectTask>
  ): MemoryStore {
    const project = getProject(store, projectId);
    if (!project) return store;

    const updatedTasks = project.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, completedAt: updates.status === "completed" ? Date.now() : t.completedAt } : t
    );

    const updatedProject: Project = {
      ...project,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    };

    return remember(store, "project", projectId, updatedProject, "high");
  }

  function completeProject(store: MemoryStore, projectId: string): MemoryStore {
    const project = getProject(store, projectId);
    if (!project) return store;

    const incompleteRequired = project.tasks.filter((t) => t.required && t.status !== "completed");
    if (incompleteRequired.length > 0) {
      logger.goal(`Cannot complete project ${project.name}: ${incompleteRequired.length} required tasks incomplete`);
      const blockedProject: Project = {
        ...project,
        status: "blocked",
        updatedAt: Date.now(),
      };
      return remember(store, "project", projectId, blockedProject, "high");
    }

    const updatedProject: Project = {
      ...project,
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      tasks: project.tasks.map((t) =>
        t.status !== "completed" ? { ...t, status: "skipped" as const, result: t.result || "Not required for completion" } : t
      ),
    };

    logger.goal(`Project completed: ${project.name}`);
    return remember(store, "project", projectId, updatedProject, "high");
  }

  function getNextTask(store: MemoryStore, projectId: string): ProjectTask | null {
    const project = getProject(store, projectId);
    if (!project) return null;

    return (
      project.tasks.find((t) => t.status === "pending" && t.required) ??
      project.tasks.find((t) => t.status === "pending") ??
      null
    );
  }

  function shouldAdvancePhase(store: MemoryStore): { shouldAdvance: boolean; nextPhase: LifePhase | null } {
    const currentPhase = getCurrentPhase(store);
    const currentProjects = getProjectsByPhase(store, currentPhase);

    if (currentProjects.length === 0) {
      return { shouldAdvance: false, nextPhase: null };
    }

    const allCompleted = currentProjects.every((p) => p.status === "completed");
    if (allCompleted) {
      const idx = PHASE_ORDER.indexOf(currentPhase);
      if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
        return { shouldAdvance: true, nextPhase: PHASE_ORDER[idx + 1] };
      }
      return { shouldAdvance: false, nextPhase: null };
    }

    return { shouldAdvance: false, nextPhase: null };
  }

  function getPhaseProgress(store: MemoryStore, phase: LifePhase): { total: number; completed: number; percentage: number } {
    const projects = getProjectsByPhase(store, phase);
    const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0);
    const completedTasks = projects.reduce(
      (sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length,
      0
    );
    return {
      total: totalTasks,
      completed: completedTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  return {
    getCurrentPhase,
    advancePhase,
    createProject,
    getProject,
    getProjectsByPhase,
    getActiveProjects,
    updateTask,
    completeProject,
    getNextTask,
    shouldAdvancePhase,
    getPhaseProgress,
  };
}

export function getPhaseTemplates(phase: LifePhase): Array<{ name: string; description: string; tasks: string[] }> {
  return PHASE_PROJECT_TEMPLATES[phase] ?? [];
}

export function createProjectFromTemplate(
  template: { name: string; description: string; tasks: string[] },
  phase: LifePhase
): Omit<Project, "id" | "createdAt" | "updatedAt" | "completedAt"> {
  return {
    name: template.name,
    description: template.description,
    phase,
    status: "planned",
    tasks: template.tasks.map((desc, i) => ({
      id: `task-${Date.now()}-${i}`,
      description: desc,
      status: "pending" as const,
      required: true,
      blockers: [],
      result: "",
      createdAt: Date.now(),
      completedAt: null,
    })),
  };
}
