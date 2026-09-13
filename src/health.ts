import { createServer, type Server } from "node:http";
import type { XykeelLogger } from "./logging/logger.js";

export interface HealthServer {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
}

export function createHealthServer(
  getStatus: () => Record<string, unknown>,
  logger: XykeelLogger
): HealthServer {
  let server: Server | null = null;

  function start(port: number): Promise<void> {
    return new Promise((resolve) => {
      if (port <= 0) {
        logger.system("Health server disabled (port <= 0)");
        resolve();
        return;
      }

      server = createServer((req, res) => {
        if (req.url === "/health" && req.method === "GET") {
          const status = getStatus();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(status));
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      });

      server.listen(port, "0.0.0.0", () => {
        logger.system(`Health server listening on port ${port}`);
        resolve();
      });
    });
  }

  function stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }

  return { start, stop };
}
