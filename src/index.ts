import { loadConfig, type XykeelConfig } from "./config/config.js";
import { createLogger, type XykeelLogger } from "./logging/logger.js";
import { createSessionState, type SessionState } from "./handoff/session.js";
import { createStore, saveStore, loadStore, type MemoryStore } from "./memory/store.js";
import { createGoal, prioritizeGoals, type Goal } from "./goals/goal.js";
import { createAIProvider, type AIProvider } from "./ai/provider.js";
import { evaluateHealth, assessRisk } from "./safety/health.js";

export interface XykeelState {
  session: SessionState;
  memory: MemoryStore;
  goals: Goal[];
  health: { health: number; hunger: number };
  running: boolean;
}

export class Xykeel {
  private config: XykeelConfig;
  private logger: XykeelLogger;
  private ai: AIProvider;
  private state: XykeelState;
  private autonomyTimer: ReturnType<typeof setInterval> | null = null;
  private memoryPath: string;

  constructor(configOverrides?: Partial<XykeelConfig>) {
    this.config = loadConfig(configOverrides);
    this.logger = createLogger(this.config.logging);
    this.memoryPath = `${this.config.storagePath}/memory.json`;
    this.state = {
      session: createSessionState(),
      memory: createStore(),
      goals: [],
      health: { health: 20, hunger: 20 },
      running: false,
    };
    this.ai = createAIProvider(this.config.ai);
  }

  async start(): Promise<void> {
    this.logger.system("Xykeel starting up...");
    this.logger.connection(`Target server: ${this.config.minecraft.host}:${this.config.minecraft.port}`);
    this.logger.connection(`Version: ${this.config.minecraft.version}`);
    this.logger.connection(`Auth: ${this.config.minecraft.auth}`);

    // Load persistent memory
    this.state.memory = loadStore(this.memoryPath);
    this.logger.memory("Loaded persistent memory", {
      entries: Object.keys(this.state.memory.entries).length,
    });

    // Initialize AI
    await this.ai.initialize();
    this.logger.system(`AI provider initialized: ${this.ai.name}`);

    // Initialize goals
    this.initializeGoals();

    this.state.running = true;
    this.logger.system("Xykeel is ready. Waiting for handoff...");

    // Start autonomy loop
    this.startAutonomyLoop();
  }

  async stop(): Promise<void> {
    this.logger.system("Xykeel shutting down...");

    if (this.autonomyTimer) {
      clearInterval(this.autonomyTimer);
      this.autonomyTimer = null;
    }

    // Save state
    saveStore(this.state.memory, this.memoryPath);
    this.logger.memory("Memory saved");

    await this.ai.shutdown();
    this.state.running = false;
    this.logger.system("Xykeel stopped.");
  }

  private initializeGoals(): void {
    // Core life goals Xykeel creates for himself
    const coreGoals: Array<{ desc: string; priority: number; meta: Record<string, unknown> }> = [
      { desc: "Find or establish a safe home", priority: 9, meta: { category: "home" } },
      { desc: "Set up organized storage", priority: 8, meta: { category: "storage" } },
      { desc: "Establish a food farm", priority: 8, meta: { category: "farming" } },
      { desc: "Gather essential resources", priority: 7, meta: { category: "mining" } },
      { desc: "Build a personal workshop", priority: 6, meta: { category: "building" } },
      { desc: "Explore the surrounding area", priority: 5, meta: { category: "exploration" } },
      { desc: "Evaluate business opportunities", priority: 4, meta: { category: "business" } },
    ];

    this.state.goals = coreGoals.map((g) =>
      createGoal({
        description: g.desc,
        type: "xykeel-own",
        priority: g.priority,
        metadata: g.meta,
      })
    );

    this.logger.goal(`Initialized ${this.state.goals.length} core goals`);
  }

  private startAutonomyLoop(): void {
    this.autonomyTimer = setInterval(() => {
      this.runAutonomyCycle();
    }, this.config.autonomy.interval);
  }

  private async runAutonomyCycle(): Promise<void> {
    if (!this.state.running) return;

    this.logger.decision("--- Autonomy Cycle ---");

    // 1. Observe
    this.logger.state(`Health: ${this.state.health.health}, Hunger: ${this.state.health.hunger}`);

    // 2. Check needs
    const healthCheck = evaluateHealth(this.state.health.health, this.state.health.hunger);
    if (!healthCheck.healthy) {
      this.logger.survival(`Health issues: ${healthCheck.issues.join("; ")}`);
      // TODO: Execute survival actions
      return;
    }

    // 3. Assess risk
    const risk = assessRisk({
      health: this.state.health.health,
      hunger: this.state.health.hunger,
      inventoryFull: false,
      nearHostile: false,
      lowDurability: false,
      nightTime: false,
    });

    if (!risk.safe) {
      this.logger.survival(`Risk: ${risk.riskLevel} — ${risk.factors.join("; ")}`);
      // TODO: Execute safety actions
      return;
    }

    // 4. Check goals
    const prioritized = prioritizeGoals(this.state.goals);
    if (prioritized.length === 0) {
      this.logger.goal("No active goals — idling");
      return;
    }

    const nextGoal = prioritized[0];
    this.logger.goal(`Next goal: ${nextGoal.description}`, { priority: nextGoal.priority });

    // 5. Ask AI what to do
    const prompt = `Current situation: Health ${this.state.health.health}/20, Hunger ${this.state.health.hunger}/20. Goal: ${nextGoal.description}. What should I do next?`;
    const decision = await this.ai.chat(prompt);
    this.logger.decision(`AI decision: ${decision}`);

    // 6. TODO: Parse decision and execute Minecraft actions
    // This will be connected in Phase 2 (Minecraft connection)
  }

  getState(): XykeelState {
    return { ...this.state };
  }

  getConfig(): XykeelConfig {
    return { ...this.config };
  }

  getLogger(): XykeelLogger {
    return this.logger;
  }

  addGoal(description: string, priority: number, metadata?: Record<string, unknown>): Goal {
    const goal = createGoal({
      description,
      type: "xykeel-own",
      priority,
      metadata,
    });
    this.state.goals.push(goal);
    this.logger.goal(`New goal: ${description}`, { id: goal.id });
    return goal;
  }

  addPlayerRequest(description: string, priority: number): Goal {
    const goal = createGoal({
      description,
      type: "player-requested",
      priority: Math.min(priority, 6), // Cap player requests below core goals
    });
    this.state.goals.push(goal);
    this.logger.goal(`Player request: ${description}`, { id: goal.id });
    return goal;
  }

  handleChat(_sender: string, message: string): string {
    this.logger.chat(`[${_sender}] ${message}`);

    // For now, return a generic acknowledgment
    // Phase 7 will implement full conversation with personality
    const lower = message.toLowerCase();
    if (lower.includes("hello") || lower.includes("hi ")) {
      return "Hey! What's up?";
    }
    return "Hmm, I'll think about that.";
  }

  updateHealth(health: number, hunger: number): void {
    this.state.health = { health, hunger };
  }
}
