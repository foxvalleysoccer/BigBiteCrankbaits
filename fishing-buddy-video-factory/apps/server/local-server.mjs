import { createServer } from "node:http";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const dataRoot = process.env.FACTORY_DATA_ROOT || join(projectRoot, "data");
const submissionsFile = join(dataRoot, "submissions.json");
const intakeDir = join(dataRoot, "gmail-intake");
const processedDir = join(dataRoot, "gmail-processed");
const rejectedDir = join(dataRoot, "gmail-rejected");
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

function readSingleLineField(body, fieldName) {
  const expression = new RegExp(`^${fieldName}:\\s*(.*)$`, "mi");
  const match = body.match(expression);
  return match?.[1]?.trim() ?? "";
}

function readMarkerBlock(body, startMarker, endMarker) {
  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return "";
  }

  return body
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
}

function parseStructuredEmailSubmission(body) {
  const parsed = {
    sourceSubmissionId: readSingleLineField(body, "SUBMISSION_ID"),
    requesterName: readSingleLineField(body, "REQUESTER_NAME"),
    requesterEmail: readSingleLineField(body, "REQUESTER_EMAIL"),
    buddyName: readSingleLineField(body, "BUDDY_NAME"),
    musicStyle: readSingleLineField(body, "MUSIC_STYLE"),
    roastLevel: readSingleLineField(body, "ROAST_LEVEL"),
    lakeName: readSingleLineField(body, "LAKE_NAME"),
    storyDetails: readMarkerBlock(body, "STORY_BEGIN", "STORY_END"),
    extraDetails: readMarkerBlock(body, "EXTRA_NOTES_BEGIN", "EXTRA_NOTES_END"),
    consentAccepted: readSingleLineField(body, "CONSENT_ACCEPTED").toUpperCase() === "YES"
  };

  if (
    !parsed.sourceSubmissionId ||
    !parsed.requesterName ||
    !parsed.requesterEmail ||
    !parsed.buddyName ||
    !parsed.musicStyle ||
    !parsed.roastLevel ||
    !parsed.storyDetails ||
    !parsed.consentAccepted
  ) {
    return null;
  }

  return parsed;
}

async function importStructuredEmailSubmissions() {
  await mkdir(intakeDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  await mkdir(rejectedDir, { recursive: true });

  const files = await readDirectorySafe(intakeDir);
  const result = {
    importedCount: 0,
    skippedCount: 0,
    imported: [],
    skipped: []
  };

  for (const file of files) {
    const sourcePath = join(intakeDir, file);
    const raw = await readFile(sourcePath, "utf8");
    const parsed = parseStructuredEmailSubmission(raw);

    if (!parsed) {
      await rename(sourcePath, join(rejectedDir, file));
      result.skippedCount += 1;
      result.skipped.push({
        emailFile: file,
        reason: "Missing required structured markers."
      });
      continue;
    }

    const submission = await createSubmission(parsed);
    await rename(sourcePath, join(processedDir, file));
    result.importedCount += 1;
    result.imported.push({
      emailFile: file,
      submissionId: submission.id
    });
  }

  return result;
}

async function readDirectorySafe(targetPath) {
  try {
    return await readdir(targetPath);
  } catch {
    return [];
  }
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

  if (request.method === "POST" && request.url === "/operator/import-gmail-submissions") {
    const result = await importStructuredEmailSubmissions();
    sendJson(response, 200, {
      ok: true,
      ...result
    });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fishing Buddy bootstrap server listening on http://127.0.0.1:${port}`);
  console.log(`Submission store: ${submissionsFile}`);
});
