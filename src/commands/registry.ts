import type { XykeelLogger } from "../logging/logger.js";
import type { MemoryStore } from "../memory/store.js";
import { remember, recall, recallCategory } from "../memory/store.js";

export type CommandSafety = "safe" | "moderate" | "dangerous" | "admin" | "unknown";

export interface ServerCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  arguments: Array<{ name: string; required: boolean; type: string }>;
  discoveredAt: number;
  lastExecutedAt: number;
  executionCount: number;
  lastResult: string;
  lastResultStatus: "success" | "failure" | "timeout" | "error" | "none";
  safety: CommandSafety;
  confidence: number;
  cooldownMs: number;
  cooldownUntil: number;
  discoveredVia: "chat_log" | "tab_complete" | "help_list" | "player_hint" | "manual";
}

export interface CommandRegistry {
  register(store: MemoryStore, cmd: ServerCommand): MemoryStore;
  get(store: MemoryStore, name: string): ServerCommand | null;
  getAll(store: MemoryStore): ServerCommand[];
  getBySafety(store: MemoryStore, safety: CommandSafety): ServerCommand[];
  recordExecution(store: MemoryStore, name: string, result: string, status: ServerCommand["lastResultStatus"]): MemoryStore;
  setCooldown(store: MemoryStore, name: string, durationMs: number): MemoryStore;
  isOnCooldown(store: MemoryStore, name: string): boolean;
  classifyCommand(name: string): CommandSafety;
  classifyFullCommand(input: string): CommandSafety;
  canExecute(store: MemoryStore, name: string): { allowed: boolean; reason: string };
}

const DANGEROUS_NAMES = new Set([
  "ban", "kick", "deop", "pardon", "whitelist",
  "gamemode", "kill", "banlist", "pardon-ip",
  "ban-ip", "kick-ip",
]);

const ADMIN_NAMES = new Set([
  "op", "deop", "whitelist", "save-all", "save-off",
  "publish", "data", "reload", "stop", "restart",
]);

const SAFE_NAMES = new Set([
  "help", "list", "msg", "w", "t", "r", "me",
  "spawn", "home", "tpa", "tpahere", "tpaccept", "tpdeny",
  "back", "warp", "bal", "balance", "pay", "shop", "jobs",
  "claim", "trust", "ecosystem", "motd", "rules", "rank",
  "kit", "daily", "vote", "rtp", "tp", "home",
  "sethome", "delhome", "near", "afk", "mail",
  "report", "bug", "ping", "whois", "seen",
  "discord", "apply", "staff",
]);

const DANGEROUS_ARGUMENT_PATTERNS = [
  /@[ae]/,
  /@\*/,
  /@s/,
  /@p/,
  /\bgive\b/i,
  /\beffect\b/i,
  /\btp\b/i,
  /\bfill\b/i,
  /\bsetblock\b/i,
  /\bsummon\b/i,
  /\bkill\b/i,
  /\bgamemode\b/i,
  /\bdifficulty\b/i,
  /\btime\s+set\b/i,
  /\bweather\b/i,
  /\bdestroy/i,
];

function extractCommandName(input: string): string {
  const trimmed = input.trim();
  const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const match = withoutSlash.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  return match ? match[1].toLowerCase() : withoutSlash.toLowerCase().split(/\s+/)[0] ?? "";
}

function hasDangerousArguments(args: string): boolean {
  return DANGEROUS_ARGUMENT_PATTERNS.some((p) => p.test(args));
}

export function createCommandRegistry(logger: XykeelLogger): CommandRegistry {
  function classifyCommand(name: string): CommandSafety {
    const cmdName = extractCommandName(name);

    if (DANGEROUS_NAMES.has(cmdName)) return "dangerous";
    if (ADMIN_NAMES.has(cmdName)) return "admin";
    if (SAFE_NAMES.has(cmdName)) return "safe";

    if (name.startsWith("/")) return "moderate";
    return "unknown";
  }

  function classifyFullCommand(input: string): CommandSafety {
    const base = classifyCommand(input);

    if (base === "dangerous" || base === "admin") return base;

    const argsStart = input.indexOf(" ");
    if (argsStart !== -1) {
      const args = input.slice(argsStart);
      if (hasDangerousArguments(args)) return "dangerous";
    }

    return base;
  }

  function registerCmd(store: MemoryStore, cmd: ServerCommand): MemoryStore {
    logger.memory(`Command registered: ${cmd.name} (safety: ${cmd.safety})`);
    return remember(store, "command", cmd.name, cmd, "medium");
  }

  function get(store: MemoryStore, name: string): ServerCommand | null {
    const entry = recall(store, "command", name);
    if (!entry) return null;
    return entry.value as ServerCommand;
  }

  function getAll(store: MemoryStore): ServerCommand[] {
    return recallCategory(store, "command").map((e) => e.value as ServerCommand);
  }

  function getBySafety(store: MemoryStore, safety: CommandSafety): ServerCommand[] {
    return getAll(store).filter((c) => c.safety === safety);
  }

  function recordExecution(
    store: MemoryStore,
    name: string,
    result: string,
    status: ServerCommand["lastResultStatus"]
  ): MemoryStore {
    const existing = get(store, name);
    if (!existing) return store;

    const updated: ServerCommand = {
      ...existing,
      lastExecutedAt: Date.now(),
      executionCount: existing.executionCount + 1,
      lastResult: result.slice(0, 500),
      lastResultStatus: status,
      confidence: Math.min(1.0, existing.confidence + (status === "success" ? 0.1 : -0.2)),
    };

    logger.memory(`Command ${name} executed: ${status}`);
    return remember(store, "command", name, updated, "medium");
  }

  function setCooldown(store: MemoryStore, name: string, durationMs: number): MemoryStore {
    const existing = get(store, name);
    if (!existing) return store;

    const updated: ServerCommand = {
      ...existing,
      cooldownMs: durationMs,
      cooldownUntil: Date.now() + durationMs,
    };

    return remember(store, "command", name, updated, "low");
  }

  function isOnCooldown(store: MemoryStore, name: string): boolean {
    const cmd = get(store, name);
    if (!cmd) return false;
    return cmd.cooldownUntil > Date.now();
  }

  function canExecute(store: MemoryStore, name: string): { allowed: boolean; reason: string } {
    const cmd = get(store, name);
    if (!cmd) {
      return { allowed: false, reason: `Unknown command: ${name}` };
    }

    if (cmd.safety === "dangerous" || cmd.safety === "admin") {
      return {
        allowed: false,
        reason: `Command ${name} classified as ${cmd.safety} — requires explicit permission`,
      };
    }

    if (cmd.safety === "unknown") {
      return {
        allowed: false,
        reason: `Command ${name} not yet classified — observing before use`,
      };
    }

    if (isOnCooldown(store, name)) {
      const remaining = cmd.cooldownUntil - Date.now();
      return { allowed: false, reason: `Command ${name} on cooldown (${remaining}ms remaining)` };
    }

    if (cmd.safety === "moderate" && cmd.confidence < 0.5) {
      return {
        allowed: false,
        reason: `Command ${name} confidence too low (${cmd.confidence.toFixed(2)}) — need more observations`,
      };
    }

    return { allowed: true, reason: "OK" };
  }

  return { register: registerCmd, get, getAll, getBySafety, recordExecution, setCooldown, isOnCooldown, classifyCommand, classifyFullCommand, canExecute };
}

export function createServerCommand(params: {
  name: string;
  aliases?: string[];
  description?: string;
  usage?: string;
  arguments?: ServerCommand["arguments"];
  discoveredVia?: ServerCommand["discoveredVia"];
  safety?: CommandSafety;
}): ServerCommand {
  return {
    name: params.name,
    aliases: params.aliases ?? [],
    description: params.description ?? "",
    usage: params.usage ?? "",
    arguments: params.arguments ?? [],
    discoveredAt: Date.now(),
    lastExecutedAt: 0,
    executionCount: 0,
    lastResult: "",
    lastResultStatus: "none",
    safety: params.safety ?? "unknown",
    confidence: 0.3,
    cooldownMs: 0,
    cooldownUntil: 0,
    discoveredVia: params.discoveredVia ?? "chat_log",
  };
}
