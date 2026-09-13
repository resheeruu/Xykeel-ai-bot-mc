import { XykeelBot } from "./xykeel.js";

const bot = new XykeelBot();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await bot.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down...");
  await bot.stop();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Start
bot.start().catch((err) => {
  console.error("Failed to start Xykeel:", err);
  process.exit(1);
});
