import { describe, it, expect } from "vitest";
import { createGoalDecomposer, createProjectFromTemplate, getPhaseTemplates } from "../src/goals/decomposer.js";
import { createStore, type MemoryStore } from "../src/memory/store.js";
import { createLogger } from "../src/logging/logger.js";

const logger = createLogger({ level: "error", output: "console", path: "/dev/null" });

function emptyStore(): MemoryStore {
  return createStore();
}

describe("GoalDecomposer", () => {
  describe("shouldAdvancePhase", () => {
    it("does NOT advance when no projects exist for current phase", () => {
      const decomposer = createGoalDecomposer(logger);
      const store = emptyStore();
      const result = decomposer.shouldAdvancePhase(store);
      expect(result.shouldAdvance).toBe(false);
      expect(result.nextPhase).toBeNull();
    });

    it("advances when all projects in current phase are completed", () => {
      const decomposer = createGoalDecomposer(logger);
      let store = emptyStore();

      // Create a project in SURVIVE phase and complete it
      store = decomposer.createProject(store, {
        name: "Basic Survival",
        description: "Survive",
        phase: "SURVIVE",
        status: "active",
        tasks: [
          { id: "t1", description: "Get food", status: "completed", required: true, blockers: [], result: "done", createdAt: Date.now(), completedAt: Date.now() },
        ],
      });

      // Complete the project
      const project = decomposer.getProject(store, decomposer.getActiveProjects(store)[0]?.id ?? "");
      if (project) {
        store = decomposer.completeProject(store, project.id);
      }

      const result = decomposer.shouldAdvancePhase(store);
      expect(result.shouldAdvance).toBe(true);
      expect(result.nextPhase).toBe("ESTABLISH");
    });

    it("does NOT advance when projects are still active", () => {
      const decomposer = createGoalDecomposer(logger);
      let store = emptyStore();

      store = decomposer.createProject(store, {
        name: "Ongoing",
        description: "Still working",
        phase: "SURVIVE",
        status: "active",
        tasks: [
          { id: "t1", description: "Task 1", status: "in_progress", required: true, blockers: [], result: "", createdAt: Date.now(), completedAt: null },
        ],
      });

      const result = decomposer.shouldAdvancePhase(store);
      expect(result.shouldAdvance).toBe(false);
    });

    it("does NOT advance when some projects are blocked", () => {
      const decomposer = createGoalDecomposer(logger);
      let store = emptyStore();

      store = decomposer.createProject(store, {
        name: "Done",
        description: "Completed",
        phase: "SURVIVE",
        status: "completed",
        tasks: [],
      });

      store = decomposer.createProject(store, {
        name: "Blocked",
        description: "Still blocked",
        phase: "SURVIVE",
        status: "blocked",
        tasks: [
          { id: "t1", description: "Blocked task", status: "blocked", required: true, blockers: ["need iron"], result: "", createdAt: Date.now(), completedAt: null },
        ],
      });

      const result = decomposer.shouldAdvancePhase(store);
      expect(result.shouldAdvance).toBe(false);
    });
  });

  describe("completeProject", () => {
    it("refuses to complete if required tasks are incomplete", () => {
      const decomposer = createGoalDecomposer(logger);
      let store = emptyStore();

      store = decomposer.createProject(store, {
        name: "Incomplete",
        description: "Has unfinished required tasks",
        phase: "SURVIVE",
        status: "active",
        tasks: [
          { id: "t1", description: "Done task", status: "completed", required: true, blockers: [], result: "done", createdAt: Date.now(), completedAt: Date.now() },
          { id: "t2", description: "Pending task", status: "pending", required: true, blockers: [], result: "", createdAt: Date.now(), completedAt: null },
        ],
      });

      const projectId = decomposer.getActiveProjects(store)[0]?.id ?? "";
      store = decomposer.completeProject(store, projectId);

      const project = decomposer.getProject(store, projectId);
      expect(project).not.toBeNull();
      expect(project!.status).toBe("blocked");
      expect(project!.completedAt).toBeNull();
    });

    it("completes when all required tasks are done", () => {
      const decomposer = createGoalDecomposer(logger);
      let store = emptyStore();

      store = decomposer.createProject(store, {
        name: "Complete",
        description: "All done",
        phase: "SURVIVE",
        status: "active",
        tasks: [
          { id: "t1", description: "Done task", status: "completed", required: true, blockers: [], result: "done", createdAt: Date.now(), completedAt: Date.now() },
          { id: "t2", description: "Optional task", status: "pending", required: false, blockers: [], result: "", createdAt: Date.now(), completedAt: null },
        ],
      });

      const projectId = decomposer.getActiveProjects(store)[0]?.id ?? "";
      store = decomposer.completeProject(store, projectId);

      const project = decomposer.getProject(store, projectId);
      expect(project).not.toBeNull();
      expect(project!.status).toBe("completed");
      expect(project!.completedAt).not.toBeNull();
    });
  });
});

describe("Phase Templates", () => {
  it("has templates for all phases", () => {
    const phases = ["SURVIVE", "ESTABLISH", "EQUIP", "MASTER", "EXPAND", "COMPETE", "BUILD", "TRADE", "DEFEND", "LONG-TERM_LEGACY"] as const;
    for (const phase of phases) {
      const templates = getPhaseTemplates(phase);
      expect(templates.length).toBeGreaterThan(0);
    }
  });

  it("creates project from template with correct structure", () => {
    const templates = getPhaseTemplates("SURVIVE");
    const project = createProjectFromTemplate(templates[0], "SURVIVE");
    expect(project.name).toBe("Basic Survival");
    expect(project.phase).toBe("SURVIVE");
    expect(project.tasks.length).toBeGreaterThan(0);
    expect(project.tasks.every((t) => t.status === "pending")).toBe(true);
  });
});
