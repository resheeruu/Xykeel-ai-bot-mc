import { XykeelBot } from "./xykeel.js";
import { createHealthServer } from "./health.js";

const bot = new XykeelBot();
const logger = bot.getLogger();
const config = bot.getConfig();

const healthServer = createHealthServer(
  () => bot.getFullStatus(),
  logger
);

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.system(`Received ${signal}, shutting down...`);

  await healthServer.stop();
  await bot.stop();

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Start
async function main(): Promise<void> {
  await healthServer.start(config.server.healthPort);
  await bot.start();
}

main().catch((err) => {
  console.error("Failed to start Xykeel:", err);
  process.exit(1);
});
