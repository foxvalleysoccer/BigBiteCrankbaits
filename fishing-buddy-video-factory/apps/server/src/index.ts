import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { importStructuredEmailSubmissions } from "./gmail-import.js";
import { processPendingSubmissions } from "./process-pending-submissions.js";
import { saveSubmission, type FishingBuddySubmissionInput } from "./submission-intake.js";

const config = loadConfig();
const app = Fastify({ logger: true });

app.addHook("onRequest", async (_request, reply) => {
  reply.header("Access-Control-Allow-Origin", config.corsOrigin);
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
});

app.options("/*", async (_request, reply) => {
  reply.code(204).send();
});

app.get("/health", async () => ({
  ok: true,
  scheduledPolling: config.scheduledPolling
}));

app.post<{ Body: FishingBuddySubmissionInput }>(
  "/api/submissions/fishing-buddy",
  async (request, reply) => {
    const body = request.body;

    if (
      !body?.requesterName ||
      !body?.requesterEmail ||
      !body?.buddyName ||
      !body?.musicStyle ||
      !body?.roastLevel ||
      !body?.storyDetails ||
      !body?.consentAccepted
    ) {
      reply.code(400);
      return {
        ok: false,
        error: "Missing required submission fields."
      };
    }

    const submission = await saveSubmission(body);
    reply.code(201);

    return {
      ok: true,
      submissionId: submission.id,
      state: submission.state
    };
  }
);

app.post("/operator/process-pending-submissions", async () => {
  const processed = await processPendingSubmissions();

  return {
    processedCount: processed.length,
    processed
  };
});

app.post("/operator/import-gmail-submissions", async () => {
  const result = await importStructuredEmailSubmissions();

  return {
    ok: true,
    ...result
  };
});

async function start(): Promise<void> {
  await app.listen({ host: "127.0.0.1", port: config.port });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
