import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { processPendingSubmissions } from "./process-pending-submissions.js";

const config = loadConfig();
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  scheduledPolling: config.scheduledPolling
}));

app.post("/operator/process-pending-submissions", async () => {
  const processed = await processPendingSubmissions();

  return {
    processedCount: processed.length,
    processed
  };
});

async function start(): Promise<void> {
  await app.listen({ host: "127.0.0.1", port: config.port });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
