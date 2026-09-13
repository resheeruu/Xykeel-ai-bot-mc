import winston from "winston";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LoggingConfig } from "../config/config.js";

export type LogCategory =
  | "connection"
  | "disconnection"
  | "handoff"
  | "goal"
  | "decision"
  | "action"
  | "error"
  | "survival"
  | "business"
  | "memory"
  | "chat"
  | "system"
  | "state"
  | "ai";

const CATEGORY_LABELS: Record<LogCategory, string> = {
  connection: "CONNECTION",
  disconnection: "DISCONNECT",
  handoff: "HANDOFF",
  goal: "GOAL",
  decision: "DECISION",
  action: "ACTION",
  error: "ERROR",
  survival: "SURVIVAL",
  business: "BUSINESS",
  memory: "MEMORY",
  chat: "CHAT",
  system: "SYSTEM",
  state: "STATE",
  ai: "AI",
};

export interface XykeelLogger {
  category(cat: LogCategory, message: string, meta?: Record<string, unknown>): void;
  connection(message: string, meta?: Record<string, unknown>): void;
  disconnection(message: string, meta?: Record<string, unknown>): void;
  handoff(message: string, meta?: Record<string, unknown>): void;
  goal(message: string, meta?: Record<string, unknown>): void;
  decision(message: string, meta?: Record<string, unknown>): void;
  action(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  survival(message: string, meta?: Record<string, unknown>): void;
  business(message: string, meta?: Record<string, unknown>): void;
  memory(message: string, meta?: Record<string, unknown>): void;
  chat(message: string, meta?: Record<string, unknown>): void;
  system(message: string, meta?: Record<string, unknown>): void;
  state(message: string, meta?: Record<string, unknown>): void;
  ai(message: string, meta?: Record<string, unknown>): void;
  raw: winston.Logger;
}

function createLogger(config: LoggingConfig): XykeelLogger {
  const transports: winston.transport[] = [];

  if (config.output === "console" || config.output === "both") {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, ...meta }) => {
            const cat = meta.category as string | undefined;
            const label = cat ? `[${CATEGORY_LABELS[cat as LogCategory] ?? cat}]` : "";
            const metaStr = Object.keys(meta).length > 1
              ? " " + JSON.stringify(meta, (_k, v) => (typeof v === "function" ? undefined : v))
              : "";
            return `${level}: ${label} ${message}${metaStr}`.trim();
          })
        ),
      })
    );
  }

  if (config.output === "file" || config.output === "both") {
    try {
      mkdirSync(dirname(config.path), { recursive: true });
    } catch {
      // directory may already exist
    }
    transports.push(
      new winston.transports.File({
        filename: config.path,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  const winstonLogger = winston.createLogger({
    level: config.level,
    transports,
    defaultMeta: { service: "xykeel" },
  });

  function cat(cat: LogCategory, message: string, meta: Record<string, unknown> = {}): void {
    winstonLogger.log("info", message, { category: cat, ...meta });
  }

  return {
    category: cat,
    connection: (m, meta) => cat("connection", m, meta),
    disconnection: (m, meta) => cat("disconnection", m, meta),
    handoff: (m, meta) => cat("handoff", m, meta),
    goal: (m, meta) => cat("goal", m, meta),
    decision: (m, meta) => cat("decision", m, meta),
    action: (m, meta) => cat("action", m, meta),
    error: (m, meta) => cat("error", m, meta),
    survival: (m, meta) => cat("survival", m, meta),
    business: (m, meta) => cat("business", m, meta),
    memory: (m, meta) => cat("memory", m, meta),
    chat: (m, meta) => cat("chat", m, meta),
    system: (m, meta) => cat("system", m, meta),
    state: (m, meta) => cat("state", m, meta),
    ai: (m, meta) => cat("ai", m, meta),
    raw: winstonLogger,
  };
}

export { createLogger };
