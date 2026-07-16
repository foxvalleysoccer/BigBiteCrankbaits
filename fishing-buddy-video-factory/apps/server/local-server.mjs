import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const dataRoot = process.env.FACTORY_DATA_ROOT || join(projectRoot, "data");
const submissionsFile = join(dataRoot, "submissions.json");
const port = Number(process.env.PORT || 4307);
const corsOrigin = process.env.CORS_ORIGIN || "*";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function buildSubmissionId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FB-${stamp}-${random}`;
}

async function ensureStore() {
  await mkdir(dataRoot, { recursive: true });

  try {
    const raw = await readFile(submissionsFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return { submissions: [] };
  }
}

async function saveStore(store) {
  await writeFile(submissionsFile, JSON.stringify(store, null, 2));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function validateSubmission(body) {
  return Boolean(
    body &&
      body.requesterName &&
      body.requesterEmail &&
      body.buddyName &&
      body.musicStyle &&
      body.roastLevel &&
      body.storyDetails &&
      body.consentAccepted
  );
}

async function createSubmission(body) {
  const store = await ensureStore();
  const submission = {
    id: buildSubmissionId(),
    requesterName: String(body.requesterName).trim(),
    requesterEmail: String(body.requesterEmail).trim(),
    buddyName: String(body.buddyName).trim(),
    musicStyle: String(body.musicStyle).trim(),
    roastLevel: String(body.roastLevel).trim(),
    lakeName: String(body.lakeName || "").trim(),
    storyDetails: String(body.storyDetails).trim(),
    extraDetails: String(body.extraDetails || "").trim(),
    state: "RECEIVED",
    createdAt: new Date().toISOString()
  };

  store.submissions.push(submission);
  await saveStore(store);
  return submission;
}

async function listPendingSubmissions() {
  const store = await ensureStore();
  return store.submissions.filter((submission) => submission.state === "RECEIVED");
}

const transitionPath = [
  "VALIDATING",
  "LYRICS_GENERATING",
  "SUNO_PENDING",
  "SONGS_READY",
  "CLIPS_SELECTING",
  "VIDEOS_RENDERING",
  "FINAL_REVIEW_READY"
];

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { ok: false, error: "Missing URL." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      mode: "bootstrap-local-server",
      dataRoot
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/submissions/fishing-buddy") {
    try {
      const rawBody = await readRequestBody(request);
      const body = JSON.parse(rawBody || "{}");

      if (!validateSubmission(body)) {
        sendJson(response, 400, {
          ok: false,
          error: "Missing required submission fields."
        });
        return;
      }

      const submission = await createSubmission(body);
      sendJson(response, 201, {
        ok: true,
        submissionId: submission.id,
        state: submission.state
      });
      return;
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: "Failed to store submission."
      });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/operator/process-pending-submissions") {
    const pending = await listPendingSubmissions();
    const processed = pending.map((submission) => ({
      ...submission,
      transitionedTo: transitionPath
    }));

    sendJson(response, 200, {
      processedCount: processed.length,
      processed
    });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fishing Buddy bootstrap server listening on http://127.0.0.1:${port}`);
  console.log(`Submission store: ${submissionsFile}`);
});
