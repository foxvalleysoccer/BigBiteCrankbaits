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
const gmailStateFile = join(dataRoot, "gmail-message-state.json");
const port = Number(process.env.PORT || 4307);
const corsOrigin = process.env.CORS_ORIGIN || "*";
const gmailQuery = process.env.GMAIL_QUERY || "label:FishingBuddySubmission is:unread";
const gmailMaxResults = Number(process.env.GMAIL_MAX_RESULTS || 10);
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || "";

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

function hasGmailCredentials() {
  return Boolean(googleClientId && googleClientSecret && googleRefreshToken);
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractPlainText(payload) {
  if (!payload) {
    return "";
  }

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    const nested = extractPlainText(part);
    if (nested) {
      return nested;
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return "";
}

async function readSeenMessageIds() {
  try {
    const raw = await readFile(gmailStateFile, "utf8");
    const parsed = JSON.parse(raw);
    return new Set(parsed.seenMessageIds ?? []);
  } catch {
    return new Set();
  }
}

async function writeSeenMessageIds(ids) {
  await writeFile(gmailStateFile, JSON.stringify({ seenMessageIds: [...ids] }, null, 2));
}

async function refreshAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: googleRefreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("No access token returned from Google.");
  }

  return payload.access_token;
}

async function listMatchingMessages(accessToken) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", gmailQuery);
  url.searchParams.set("maxResults", String(gmailMaxResults));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Gmail list failed with status ${response.status}`);
  }

  const payload = await response.json();
  return (payload.messages ?? []).map((message) => message.id);
}

async function fetchMessageBody(accessToken, messageId) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail message fetch failed with status ${response.status}`);
  }

  const payload = await response.json();
  return extractPlainText(payload.payload);
}

async function fetchStructuredGmailMessagesToIntake() {
  if (!hasGmailCredentials()) {
    return {
      enabled: false,
      fetchedCount: 0,
      skippedCount: 0,
      fetched: [],
      skipped: []
    };
  }

  await mkdir(intakeDir, { recursive: true });

  const accessToken = await refreshAccessToken();
  const seenIds = await readSeenMessageIds();
  const messageIds = await listMatchingMessages(accessToken);
  const result = {
    enabled: true,
    fetchedCount: 0,
    skippedCount: 0,
    fetched: [],
    skipped: []
  };

  for (const messageId of messageIds) {
    if (seenIds.has(messageId)) {
      result.skippedCount += 1;
      result.skipped.push({
        messageId,
        reason: "Already fetched locally."
      });
      continue;
    }

    const body = await fetchMessageBody(accessToken, messageId);
    if (!body.trim()) {
      result.skippedCount += 1;
      result.skipped.push({
        messageId,
        reason: "No readable plain-text body."
      });
      continue;
    }

    await writeFile(join(intakeDir, `${messageId}.txt`), body);
    seenIds.add(messageId);
    result.fetchedCount += 1;
    result.fetched.push(messageId);
  }

  await writeSeenMessageIds(seenIds);
  return result;
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
  const fetch = await fetchStructuredGmailMessagesToIntake();
  await mkdir(intakeDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  await mkdir(rejectedDir, { recursive: true });

  const files = await readDirectorySafe(intakeDir);
  const result = {
    fetch,
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
