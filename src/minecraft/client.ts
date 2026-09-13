import mineflayer from "mineflayer";
import pathfinder from "mineflayer-pathfinder";
import type { MinecraftConfig } from "../config/config.js";
import type { XykeelLogger } from "../logging/logger.js";

export interface MinecraftClient {
  bot: mineflayer.Bot | null;
  connected: boolean;
  connect(): Promise<mineflayer.Bot>;
  disconnect(): void;
  sendChat(message: string): void;
}

export function createMinecraftClient(
  config: MinecraftConfig,
  logger: XykeelLogger
): MinecraftClient {
  let bot: mineflayer.Bot | null = null;
  let connected = false;

  function connect(): Promise<mineflayer.Bot> {
    return new Promise((resolve, reject) => {
      logger.connection(`Connecting to ${config.host}:${config.port}...`);

      const options: mineflayer.BotOptions = {
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version,
        auth: config.auth,
      };

      if (config.auth === "microsoft" && config.email) {
        options.username = config.email;
      }

      const newBot = mineflayer.createBot(options);

      // Load pathfinder plugin immediately
      newBot.loadPlugin(pathfinder as unknown as Parameters<typeof newBot.loadPlugin>[0]);

      newBot.on("spawn", () => {
        connected = true;
        bot = newBot;
        logger.connection(`Connected as ${config.username}`);
        resolve(newBot);
      });

      newBot.on("error", (err: Error) => {
        logger.error(`Connection error: ${err.message}`);
        if (!connected) {
          reject(err);
        }
      });

      newBot.on("kicked", (reason: string) => {
        logger.disconnection(`Kicked: ${reason}`);
        connected = false;
        bot = null;
      });

      newBot.on("end", (reason: string) => {
        logger.disconnection(`Disconnected: ${reason}`);
        connected = false;
        bot = null;
      });

      newBot.on("login", () => {
        logger.connection("Logged in, waiting for spawn...");
      });

      newBot.on("health", () => {
        // Health events handled by survival module
      });
    });
  }

  function disconnect(): void {
    if (bot) {
      logger.disconnection("Disconnecting...");
      bot.quit();
      bot = null;
      connected = false;
    }
  }

  function sendChat(message: string): void {
    if (bot && connected) {
      bot.chat(message);
    }
  }

  return {
    get bot() { return bot; },
    get connected() { return connected; },
    connect,
    disconnect,
    sendChat,
  };
}
