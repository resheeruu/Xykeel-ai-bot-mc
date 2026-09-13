import { loadConfig, type XykeelConfig } from "./config/config.js";
import { createLogger, type XykeelLogger } from "./logging/logger.js";
import {
  createSessionState,
  shouldXykeelTakeOver,
  markXykeelConnect,
  markXykeelDisconnect,
  incrementReconnect,
  type SessionState,
} from "./handoff/session.js";
import { createStore, saveStore, loadStore, remember, type MemoryStore } from "./memory/store.js";
import { createGoal, prioritizeGoals, completeGoal, type Goal } from "./goals/goal.js";
import { createAIProvider, type AIProvider } from "./ai/provider.js";
import { evaluateHealth, assessRisk } from "./safety/health.js";
import { createMinecraftClient, type MinecraftClient } from "./minecraft/client.js";
import { createPlayerTracker, type PlayerTracker } from "./minecraft/players.js";
import { createChatObserver, type ChatObserver } from "./minecraft/chat.js";
import { createWorldTracker, type WorldTracker } from "./minecraft/world.js";
import { createInventoryTracker, type InventoryTracker } from "./minecraft/inventory.js";
import { createPlanner, type Planner, type Plan } from "./autonomy/planner.js";
import { createSurvivalActions, type SurvivalActions } from "./survival/actions.js";
import { createNavigation } from "./navigation/navigator.js";
import { createHomeSystem } from "./world/home.js";
import { createFarmSystem } from "./world/farm.js";
import { createLocationTracker } from "./world/locations.js";
import { createRelationshipSystem } from "./relationships/system.js";

export type BotStatus =
  | "DISCONNECTED"
  | "HUMAN_ACTIVE"
  | "XYKEEL_ACTIVE"
  | "TRANSITIONING_TO_XYKEEL"
  | "TRANSITIONING_TO_HUMAN"
  | "STOPPING"
  | "ERROR"
  | "WAITING_HANDOFF";

export interface XykeelBotConfig extends XykeelConfig {}

export class XykeelBot {
  private config: XykeelBotConfig;
  private logger: XykeelLogger;
  private status: BotStatus = "DISCONNECTED";

  // Minecraft
  private client: MinecraftClient;
  private playerTracker: PlayerTracker;
  private chatObserver: ChatObserver;
  private worldTracker: WorldTracker;
  private inventoryTracker: InventoryTracker;

  // AI & Autonomy
  private ai: AIProvider;
  private planner: Planner;
  private survivalActions: SurvivalActions;

  // Systems
  private homeSystem: ReturnType<typeof createHomeSystem>;
  private farmSystem: ReturnType<typeof createFarmSystem>;
  private locationTracker: ReturnType<typeof createLocationTracker>;
  private relationshipSystem: ReturnType<typeof createRelationshipSystem>;

  // State
  private session: SessionState;
  private memory: MemoryStore;
  private goals: Goal[] = [];
  private memoryPath: string;
  private running = false;

  // Timers
  private autonomyTimer: ReturnType<typeof setInterval> | null = null;
  private handoffTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;

  // Current state
  private health = { health: 20, hunger: 20 };
  private currentPlan: Plan | null = null;
  private currentActionIndex = 0;
  private lastDecision = "";
  private startTime = Date.now();
  private currentActivity = "Idle";

  constructor(configOverrides?: Partial<XykeelBotConfig>) {
    this.config = loadConfig(configOverrides);
    this.logger = createLogger(this.config.logging);
    this.memoryPath = `${this.config.storagePath}/memory.json`;

    // Create all subsystems
    this.client = createMinecraftClient(this.config.minecraft, this.logger);
    this.playerTracker = createPlayerTracker(this.logger);
    this.chatObserver = createChatObserver(this.logger);
    this.worldTracker = createWorldTracker(this.logger);
    this.inventoryTracker = createInventoryTracker(this.logger);

    this.ai = createAIProvider(this.config.ai);
    this.planner = createPlanner();
    this.survivalActions = createSurvivalActions(this.logger);
    createNavigation(this.logger); // Initialize navigation system

    this.homeSystem = createHomeSystem(this.logger);
    this.farmSystem = createFarmSystem(this.logger);
    this.locationTracker = createLocationTracker(this.logger);
    this.relationshipSystem = createRelationshipSystem(this.logger);

    this.session = createSessionState();
    this.memory = createStore();
  }

  // ========================
  // LIFECYCLE
  // ========================

  async start(): Promise<void> {
    this.logger.system("=== Xykeel Bot Starting ===");
    this.logger.connection(`Server: ${this.config.minecraft.host}:${this.config.minecraft.port}`);
    this.logger.connection(`Version: ${this.config.minecraft.version}`);
    this.logger.connection(`Auth: ${this.config.minecraft.auth}`);

    // Load persistent memory
    this.memory = loadStore(this.memoryPath);
    this.logger.memory("Memory loaded", {
      entries: Object.keys(this.memory.entries).length,
    });

    // Load persisted goals from memory
    this.loadPersistedGoals();

    // Initialize AI
    await this.ai.initialize();
    this.logger.system(`AI: ${this.ai.name}`);

    this.running = true;

    // Start status reporter
    this.startStatusReporter();

    // Start handoff check
    this.startHandoffCheck();

    this.logger.system("Xykeel ready. Waiting for handoff trigger...");
  }

  async stop(): Promise<void> {
    this.logger.system("=== Xykeel Bot Stopping ===");
    this.status = "STOPPING";
    this.running = false;

    this.clearAllTimers();

    // Disconnect if connected
    if (this.client.connected) {
      this.saveState();
      this.client.disconnect();
    }

    await this.ai.shutdown();
    this.status = "DISCONNECTED";
    this.logger.system("Xykeel stopped.");
  }

  // ========================
  // HANDOFF
  // ========================

  private startHandoffCheck(): void {
    this.handoffTimer = setInterval(() => {
      this.checkHandoff();
    }, 5000);
  }

  private checkHandoff(): void {
    if (!this.running) return;

    // If not connected and should take over
    if (!this.client.connected && this.session.mode !== "human") {
      if (shouldXykeelTakeOver(this.session, this.config.autonomy.handoffDelay)) {
        this.connectAsXykeel();
      }
    }
  }

  private async connectAsXykeel(): Promise<void> {
    if (this.status === "TRANSITIONING_TO_XYKEEL" || this.status === "XYKEEL_ACTIVE") return;

    this.status = "TRANSITIONING_TO_XYKEEL";
    this.logger.handoff("Transitioning to XYKEEL control");

    try {
      const bot = await this.client.connect();

      // Wire all events
      this.wireBotEvents(bot);

      this.session = markXykeelConnect(this.session);
      this.status = "XYKEEL_ACTIVE";
      this.logger.handoff("XYKEEL active — autonomous mode engaged");

      // Start autonomy
      this.startAutonomyLoop();

      // Record connection in memory
      this.memory = remember(this.memory, "event", "xykeel_connect", {
        timestamp: Date.now(),
        position: this.worldTracker.getState().position,
      }, "high");
    } catch (err) {
      this.logger.error(`Connection failed: ${err}`);
      this.status = "ERROR";
      this.session = incrementReconnect(this.session);

      if (this.session.reconnectAttempts >= this.config.autonomy.maxReconnectAttempts) {
        this.logger.error("Max reconnect attempts reached. Stopping.");
        this.status = "DISCONNECTED";
        return;
      }

      // Exponential backoff
      const delay = Math.min(30000, 2000 * Math.pow(2, this.session.reconnectAttempts));
      this.logger.system(`Retrying in ${delay}ms (attempt ${this.session.reconnectAttempts})`);
      this.reconnectTimer = setTimeout(() => {
        this.connectAsXykeel();
      }, delay);
    }
  }

  private wireBotEvents(bot: import("mineflayer").Bot): void {
    // Chat -> relationship + chat observer
    this.chatObserver.start(bot);

    // Health tracking
    bot.on("health", () => {
      if (bot.health !== undefined) this.health.health = Math.round(bot.health);
      if (bot.food !== undefined) this.health.hunger = Math.round(bot.food);

      // Survival priority: if health is critical, interrupt autonomy
      if (this.health.health <= 6 || this.health.hunger <= 0) {
        this.handleSurvivalEmergency();
      }
    });

    // Player tracking
    bot.on("playerCollect", () => {
      this.playerTracker.update(bot);
    });

    // Chat -> relationship system
    bot.on("chat", (username: string, message: string) => {
      if (username === bot.username) return;
      const player = this.playerTracker.players.get(username);
      if (player) {
        this.memory = this.relationshipSystem.recordInteraction(
          this.memory, player.uuid, player.username, 1
        );
      }
      // Xykeel's chat response
      const response = this.generateChatResponse(username, message);
      if (response) {
        this.client.sendChat(response);
      }
    });

    // Death -> save and retreat
    bot.on("death", () => {
      this.logger.survival("Died! Saving state.");
      this.saveState();
      this.currentPlan = null;
      this.currentActionIndex = 0;
    });

    // Kicked -> handle handoff
    bot.on("kicked", (reason: string) => {
      this.logger.disconnection(`Kicked: ${reason}`);
      this.handleDisconnect();
    });

    // End -> handle disconnect
    bot.on("end", (reason: string) => {
      this.logger.disconnection(`Disconnected: ${reason}`);
      this.handleDisconnect();
    });

    // Error
    bot.on("error", (err: Error) => {
      this.logger.error(`Bot error: ${err.message}`);
    });
  }

  private handleDisconnect(): void {
    this.stopAutonomyLoop();
    this.saveState();
    this.status = "DISCONNECTED";
    this.session = markXykeelDisconnect(this.session);
  }

  private handleSurvivalEmergency(): void {
    this.logger.survival("SURVIVAL EMERGENCY — interrupting autonomy");
    this.currentPlan = null;
    this.currentActionIndex = 0;

    const bot = this.client.bot;
    if (!bot) return;

    if (this.health.hunger <= 0) {
      this.survivalActions.eat(bot, this.inventoryTracker.getState());
    }

    if (this.health.health <= 6) {
      this.survivalActions.retreat(bot);
    }
  }

  // ========================
  // AUTONOMY
  // ========================

  private startAutonomyLoop(): void {
    this.stopAutonomyLoop();
    this.autonomyTimer = setInterval(() => {
      this.runAutonomyCycle();
    }, this.config.autonomy.interval);
  }

  private stopAutonomyLoop(): void {
    if (this.autonomyTimer) {
      clearInterval(this.autonomyTimer);
      this.autonomyTimer = null;
    }
  }

  private async runAutonomyCycle(): Promise<void> {
    if (!this.running || this.status !== "XYKEEL_ACTIVE") return;

    const bot = this.client.bot;
    if (!bot || !this.client.connected) return;

    this.logger.decision("--- Autonomy Cycle ---");

    // 1. OBSERVE: Update all trackers from real Minecraft state
    this.worldTracker.update(bot);
    this.inventoryTracker.update(bot);
    this.playerTracker.update(bot);

    const world = this.worldTracker.getState();
    const inventory = this.inventoryTracker.getState();

    // 2. UPDATE STATE
    const healthCheck = evaluateHealth(this.health.health, this.health.hunger);

    // 3. CHECK SAFETY
    const risk = assessRisk({
      health: this.health.health,
      hunger: this.health.hunger,
      inventoryFull: inventory.isFull,
      nearHostile: world.nearbyEntities.some(
        (e) => e.type === "hostile" && e.distance < 10
      ),
      lowDurability: false,
      nightTime: !world.isDaytime,
    });

    if (!risk.safe) {
      this.logger.survival(`Risk: ${risk.riskLevel} — ${risk.factors.join("; ")}`);
      this.currentActivity = `Avoiding risk: ${risk.riskLevel}`;
      this.lastDecision = `Safety override: ${risk.factors[0]}`;
      // Don't proceed with normal planning
      return;
    }

    // 4. CHECK NEEDS
    if (!healthCheck.healthy) {
      this.logger.survival(`Health issues: ${healthCheck.issues.join("; ")}`);
      this.currentActivity = "Addressing health issues";
      if (inventory.hasFood && this.health.hunger < 14) {
        await this.survivalActions.eat(bot, inventory);
      }
      return;
    }

    // 5. CHECK GOALS
    const prioritized = prioritizeGoals(this.goals);
    if (prioritized.length === 0) {
      this.logger.goal("No active goals — idling");
      this.currentActivity = "Idle";
      return;
    }

    const nextGoal = prioritized[0];

    // 6. SELECT PRIORITY + CREATE PLAN
    if (!this.currentPlan || this.currentActionIndex >= this.currentPlan.actions.length) {
      this.currentPlan = this.planner.createPlan(nextGoal, world, inventory, healthCheck);
      this.currentActionIndex = 0;
      this.logger.goal(`Plan: ${nextGoal.description}`, {
        actions: this.currentPlan.actions.length,
      });
    }

    // 7. EXECUTE ACTIONS
    const action = this.currentPlan.actions[this.currentActionIndex];
    if (action) {
      this.currentActivity = action.description;
      this.lastDecision = `Goal: ${nextGoal.description} → ${action.description}`;
      this.logger.action(`Executing: ${action.description}`);

      const success = await this.executeAction(bot, action);

      // 8. VERIFY RESULT
      if (success) {
        this.logger.action(`Completed: ${action.description}`);
        this.memory = remember(this.memory, "action_log", `${Date.now()}`, {
          action: action.description,
          goal: nextGoal.description,
          success: true,
        }, "low");
      } else {
        this.logger.action(`Failed: ${action.description}`);
        this.memory = remember(this.memory, "failed_action", `${Date.now()}`, {
          action: action.description,
          goal: nextGoal.description,
          success: false,
        }, "medium");
      }

      this.currentActionIndex++;

      // 9. CHECK IF PLAN COMPLETE
      if (this.currentActionIndex >= this.currentPlan.actions.length) {
        this.logger.decision(`Plan complete: ${nextGoal.description}`);
        this.goals = this.goals.map((g) =>
          g.id === nextGoal.id ? completeGoal(g) : g
        );
        this.currentPlan = null;
        this.currentActionIndex = 0;

        this.memory = remember(this.memory, "goal_complete", nextGoal.id, {
          description: nextGoal.description,
          completedAt: Date.now(),
        }, "high");
      }
    }

    // 10. SAVE MEMORY periodically (not every tick)
    // Memory is saved on disconnect and periodically via saveState
  }

  // ========================
  // ACTION EXECUTION
  // ========================

  private async executeAction(
    bot: import("mineflayer").Bot,
    action: { type: string; description: string; params: Record<string, unknown> }
  ): Promise<boolean> {
    switch (action.type) {
      case "find_location":
        return this.executeFindLocation(bot);
      case "gather_materials":
        return this.executeGatherMaterials(bot, action.params);
      case "build_structure":
        return this.executeBuildStructure(bot);
      case "place_bed":
        return this.executePlaceItem(bot, "bed");
      case "place_chest":
        return this.executePlaceItem(bot, "chest");
      case "prepare_equipment":
        return this.executePrepareEquipment(bot);
      case "find_mine":
        return this.executeFindMine(bot);
      case "mine_resources":
        return this.executeMineResources(bot, action.params);
      case "return_home":
        return this.executeReturnHome(bot);
      case "store_resources":
        return this.executeStoreResources(bot);
      case "find_farmland":
        return this.executeFindFarmland(bot);
      case "gather_seeds":
        return this.executeGatherSeeds(bot);
      case "till_soil":
        return this.executeTillSoil(bot);
      case "plant_crops":
        return this.executePlantCrops(bot);
      case "harvest":
        return this.executeHarvest(bot);
      case "explore_area":
        return this.executeExploreArea(bot);
      case "mark_locations":
        return this.executeMarkLocations(bot);
      case "evaluate_opportunities":
        return this.executeEvaluateOpportunities(bot);
      case "assess":
      case "act":
        return true; // Generic actions
      default:
        this.logger.action(`Unknown action type: ${action.type} — skipping`);
        return false;
    }
  }

  private async executeFindLocation(bot: import("mineflayer").Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;
    const pos = bot.entity.position;

    // Check if we already have a home
    if (this.homeSystem.hasHome(this.memory)) {
      this.logger.action("Home already established");
      return true;
    }

    // Record current position as potential home
    this.memory = this.homeSystem.setHomeLocation(
      this.memory, Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)
    );

    this.memory = this.locationTracker.addLocation(this.memory, {
      id: `home-${Date.now()}`,
      name: "Xykeel's Home",
      category: "home",
      location: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
      notes: "Primary residence",
      discoveredAt: Date.now(),
    });

    return true;
  }

  private async executeGatherMaterials(
    bot: import("mineflayer").Bot,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const materials = (params.materials as string[]) ?? ["oak_log"];
    for (const material of materials) {
      if (material.includes("_log")) {
        const result = await this.survivalActions.equipBestTool(bot, "axe");
        if (!result) {
          // Try punching
          const log = bot.findBlock({
            matching: (b) => b.name.includes("_log"),
            maxDistance: 16,
          });
          if (log) {
            try {
              await bot.pathfinder.goto(
                new (await import("mineflayer-pathfinder")).goals.GoalBlock(
                  log.position.x, log.position.y, log.position.z
                )
              );
              await bot.dig(log);
            } catch {
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  private async executeBuildStructure(bot: import("mineflayer").Bot): Promise<boolean> {
    // Basic shelter: just ensure we have a safe spot
    this.logger.action("Building basic shelter (finding safe location)");
    return this.executeFindLocation(bot);
  }

  private async executePlaceItem(bot: import("mineflayer").Bot, itemName: string): Promise<boolean> {
    const item = bot.inventory.items().find((i) => i.name.includes(itemName));
    if (!item) {
      this.logger.action(`No ${itemName} in inventory to place`);
      return false;
    }

    try {
      await bot.equip(item, "hand");
      // Place at current position + 1 forward
      if (bot.entity?.position) {
        const dir = bot.entity.yaw;
        const x = bot.entity.position.x + Math.round(-Math.sin(dir));
        const z = bot.entity.position.z + Math.round(Math.cos(dir));
        const block = bot.blockAt({ x, y: bot.entity.position.y, z } as never);
        if (block) {
          // mineflayer placeBlock accepts {x,y,z} at runtime despite Vec3 type
          await bot.placeBlock(block, { x: 0, y: 1, z: 0 } as never);
          this.logger.action(`Placed ${itemName}`);
          return true;
        }
      }
    } catch (err) {
      this.logger.error(`Failed to place ${itemName}: ${err}`);
    }
    return false;
  }

  private async executePrepareEquipment(bot: import("mineflayer").Bot): Promise<boolean> {
    const inv = this.inventoryTracker.getState();
    if (!inv.hasPickaxe) {
      this.logger.action("No pickaxe available — cannot proceed with mining");
      return false;
    }
    await this.survivalActions.equipBestTool(bot, "pickaxe");
    if (!inv.hasFood) {
      this.logger.action("Warning: No food for mining trip");
    }
    return true;
  }

  private async executeFindMine(bot: import("mineflayer").Bot): Promise<boolean> {
    // Look for cave entrance or dig down
    const stone = bot.findBlock({
      matching: (b) => b.name === "stone" || b.name === "deepslate",
      maxDistance: 16,
    });
    if (stone) {
      this.logger.action(`Found mineable area at ${stone.position}`);
      return true;
    }
    this.logger.action("No mine found nearby — will dig");
    return true;
  }

  private async executeMineResources(
    bot: import("mineflayer").Bot,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const targetBlock = (params.block as string) ?? "iron_ore";
    const count = (params.count as number) ?? 16;

    let mined = 0;
    for (let i = 0; i < count; i++) {
      const block = bot.findBlock({
        matching: (b) => b.name === targetBlock,
        maxDistance: 32,
      });
      if (!block) break;

      try {
        await bot.pathfinder.goto(
          new (await import("mineflayer-pathfinder")).goals.GoalBlock(
            block.position.x, block.position.y, block.position.z
          )
        );
        await bot.dig(block);
        mined++;
      } catch {
        break;
      }
    }

    if (mined > 0) {
      this.logger.action(`Mined ${mined} ${targetBlock}`);
      this.memory = remember(this.memory, "mining_result", `${Date.now()}`, {
        block: targetBlock,
        count: mined,
      }, "medium");
      return true;
    }
    return false;
  }

  private async executeReturnHome(bot: import("mineflayer").Bot): Promise<boolean> {
    const home = this.homeSystem.getHomeLocation(this.memory);
    if (!home) {
      this.logger.action("No home location known");
      return false;
    }

    try {
      await bot.pathfinder.goto(
        new (await import("mineflayer-pathfinder")).goals.GoalBlock(home.x, home.y, home.z)
      );
      this.logger.action("Returned home");
      return true;
    } catch {
      this.logger.error("Failed to navigate home");
      return false;
    }
  }

  private async executeStoreResources(_bot: import("mineflayer").Bot): Promise<boolean> {
    // Store resources at home chest
    this.logger.action("Storing resources (chest interaction pending)");
    return true;
  }

  private async executeFindFarmland(bot: import("mineflayer").Bot): Promise<boolean> {
    const farms = this.farmSystem.getFarms(this.memory);
    if (farms.length > 0) {
      this.logger.action(`Found ${farms.length} existing farm(s)`);
      return true;
    }

    // Create a new farm entry
    if (bot.entity?.position) {
      const pos = bot.entity.position;
      this.memory = this.farmSystem.addFarm(this.memory, {
        id: `farm-${Date.now()}`,
        name: "Xykeel's Farm",
        location: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
        cropType: "wheat",
        status: "planting",
        plantedAt: Date.now(),
      });
      return true;
    }
    return false;
  }

  private async executeGatherSeeds(bot: import("mineflayer").Bot): Promise<boolean> {
    // Break grass to get seeds
    const grass = bot.findBlock({
      matching: (b) => b.name === "short_grass" || b.name === "grass",
      maxDistance: 8,
    });
    if (grass) {
      try {
        await bot.dig(grass);
        this.logger.action("Gathered seeds from grass");
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private async executeTillSoil(_bot: import("mineflayer").Bot): Promise<boolean> {
    this.logger.action("Tilling soil (hoe action pending)");
    return true;
  }

  private async executePlantCrops(_bot: import("mineflayer").Bot): Promise<boolean> {
    this.logger.action("Planting crops (seed placement pending)");
    return true;
  }

  private async executeHarvest(bot: import("mineflayer").Bot): Promise<boolean> {
    const wheat = bot.findBlock({
      matching: (b) => b.name === "wheat" && b.metadata >= 7,
      maxDistance: 16,
    });
    if (wheat) {
      try {
        await bot.dig(wheat);
        this.logger.action("Harvested wheat");
        this.memory = remember(this.memory, "farm_harvest", `${Date.now()}`, {
          crop: "wheat",
          harvestedAt: Date.now(),
        }, "medium");
        return true;
      } catch {
        return false;
      }
    }
    this.logger.action("No mature crops to harvest");
    return false;
  }

  private async executeExploreArea(bot: import("mineflayer").Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;
    const pos = bot.entity.position;

    // Explore in a random direction
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const targetX = pos.x + Math.round(Math.cos(angle) * distance);
    const targetZ = pos.z + Math.round(Math.sin(angle) * distance);

    try {
      await bot.pathfinder.goto(
        new (await import("mineflayer-pathfinder")).goals.GoalBlock(targetX, pos.y, targetZ)
      );

      // Record discovered location
      this.memory = this.locationTracker.addLocation(this.memory, {
        id: `explore-${Date.now()}`,
        name: `Explored area at ${targetX},${targetZ}`,
        category: "landmark",
        location: { x: targetX, y: Math.round(pos.y), z: targetZ },
        notes: `Discovered during exploration`,
        discoveredAt: Date.now(),
      });

      this.logger.action(`Explored to ${targetX},${targetZ}`);
      return true;
    } catch {
      this.logger.error("Exploration navigation failed");
      return false;
    }
  }

  private async executeMarkLocations(bot: import("mineflayer").Bot): Promise<boolean> {
    if (!bot.entity?.position) return false;

    // Mark interesting nearby blocks
    const ores = ["iron_ore", "gold_ore", "diamond_ore", "coal_ore"];
    for (const ore of ores) {
      const block = bot.findBlock({
        matching: (b) => b.name === ore,
        maxDistance: 32,
      });
      if (block) {
        this.memory = this.locationTracker.addLocation(this.memory, {
          id: `ore-${ore}-${Date.now()}`,
          name: `${ore} deposit`,
          category: "resource",
          location: {
            x: block.position.x,
            y: block.position.y,
            z: block.position.z,
          },
          notes: `Found during exploration`,
          discoveredAt: Date.now(),
        });
      }
    }

    return true;
  }

  private async executeEvaluateOpportunities(_bot: import("mineflayer").Bot): Promise<boolean> {
    // Evaluate what business we could start based on available resources
    const hasFarms = this.farmSystem.getFarms(this.memory).length > 0;

    if (hasFarms) {
      this.logger.business("Farm detected — could start farm shop");
    }

    this.logger.business("Business evaluation complete (planning mode)");
    return true;
  }

  // ========================
  // CHAT
  // ========================

  private generateChatResponse(sender: string, message: string): string | null {
    const lower = message.toLowerCase();

    // Greetings
    if (lower.includes("hello") || lower.includes("hi ") || lower.includes("hey")) {
      return `Hey ${sender}!`;
    }

    // Questions about what Xykeel is doing
    if (lower.includes("what are you doing") || lower.includes("whatcha")) {
      return `Working on: ${this.currentActivity}`;
    }

    // Requests to follow/go somewhere
    if (lower.includes("come with me") || lower.includes("follow")) {
      // Xykeel decides
      if (this.currentPlan) {
        return `Not right now, I'm busy with something.`;
      }
      return `Sure, where to?`;
    }

    // Give items
    if (lower.includes("give me") || lower.includes("can i have")) {
      return `I'm keeping my stuff for now, sorry.`;
    }

    // Default: acknowledge but don't auto-obey
    return null;
  }

  // ========================
  // STATE MANAGEMENT
  // ========================

  private saveState(): void {
    saveStore(this.memory, this.memoryPath);

    // Also save goals
    this.memory = remember(this.memory, "state", "goals", this.goals, "high");
    this.memory = remember(this.memory, "state", "health", this.health, "medium");
    this.memory = remember(this.memory, "state", "session", this.session, "high");
    this.memory = remember(this.memory, "state", "last_activity", this.currentActivity, "medium");

    saveStore(this.memory, this.memoryPath);
  }

  private loadPersistedGoals(): void {
    const goalsEntry = this.memory.entries["state::goals"];
    if (goalsEntry && Array.isArray(goalsEntry.value)) {
      this.goals = goalsEntry.value as Goal[];
      this.logger.memory(`Loaded ${this.goals.length} persisted goals`);
    } else {
      this.initializeCoreGoals();
    }

    const healthEntry = this.memory.entries["state::health"];
    if (healthEntry) {
      this.health = healthEntry.value as { health: number; hunger: number };
    }
  }

  private initializeCoreGoals(): void {
    const coreGoals = [
      { desc: "Find or establish a safe home", priority: 9, meta: { category: "home" } },
      { desc: "Set up organized storage", priority: 8, meta: { category: "storage" } },
      { desc: "Establish a food farm", priority: 8, meta: { category: "farming" } },
      { desc: "Gather essential resources", priority: 7, meta: { category: "mining" } },
      { desc: "Build a personal workshop", priority: 6, meta: { category: "building" } },
      { desc: "Explore the surrounding area", priority: 5, meta: { category: "exploration" } },
      { desc: "Evaluate business opportunities", priority: 4, meta: { category: "business" } },
    ];

    this.goals = coreGoals.map((g) =>
      createGoal({
        description: g.desc,
        type: "xykeel-own",
        priority: g.priority,
        metadata: g.meta,
      })
    );

    this.logger.goal(`Initialized ${this.goals.length} core goals`);
  }

  // ========================
  // STATUS & OBSERVABILITY
  // ========================

  private startStatusReporter(): void {
    this.statusTimer = setInterval(() => {
      this.logStatus();
    }, 60_000); // Every 60 seconds
  }

  private logStatus(): void {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const pos = this.worldTracker.getState().position;
    const posStr = pos ? `${pos.x}, ${pos.y}, ${pos.z}` : "unknown";

    this.logger.system(
      `[STATUS] Session: ${this.status} | ` +
      `MC: ${this.client.connected ? "CONNECTED" : "DISCONNECTED"} | ` +
      `HP: ${this.health.health}/20 | Food: ${this.health.hunger}/20 | ` +
      `Pos: ${posStr} | ` +
      `Goal: ${this.goals.filter((g) => g.status === "pending" || g.status === "active")[0]?.description ?? "none"} | ` +
      `Activity: ${this.currentActivity} | ` +
      `Uptime: ${uptime}s`
    );
  }

  // ========================
  // PUBLIC API
  // ========================

  getStatus(): BotStatus {
    return this.status;
  }

  getFullStatus(): Record<string, unknown> {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const pos = this.worldTracker.getState().position;
    const activeGoals = this.goals.filter((g) => g.status === "pending" || g.status === "active");

    return {
      session: this.status,
      minecraft: this.client.connected ? "CONNECTED" : "DISCONNECTED",
      health: this.health.health,
      hunger: this.health.hunger,
      position: pos,
      currentGoal: activeGoals[0]?.description ?? "none",
      currentActivity: this.currentActivity,
      lastDecision: this.lastDecision,
      uptime,
      goalsActive: activeGoals.length,
      goalsCompleted: this.goals.filter((g) => g.status === "completed").length,
      memoryEntries: Object.keys(this.memory.entries).length,
      players: this.playerTracker.getPlayers().map((p) => p.username),
    };
  }

  getConfig(): XykeelBotConfig {
    return this.config;
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
    this.goals.push(goal);
    this.logger.goal(`New goal: ${description}`, { id: goal.id });
    return goal;
  }

  addPlayerRequest(description: string, priority: number): Goal {
    const goal = createGoal({
      description,
      type: "player-requested",
      priority: Math.min(priority, 6),
    });
    this.goals.push(goal);
    this.logger.goal(`Player request: ${description}`, { id: goal.id });
    return goal;
  }

  // ========================
  // CLEANUP
  // ========================

  private clearAllTimers(): void {
    if (this.autonomyTimer) {
      clearInterval(this.autonomyTimer);
      this.autonomyTimer = null;
    }
    if (this.handoffTimer) {
      clearInterval(this.handoffTimer);
      this.handoffTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }
}
