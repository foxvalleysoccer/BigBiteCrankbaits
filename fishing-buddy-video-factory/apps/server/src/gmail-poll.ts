import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
};

type GmailMessageResponse = {
  id: string;
  payload?: GmailPayload;
};

export type GmailFetchResult = {
  enabled: boolean;
  fetchedCount: number;
  skippedCount: number;
  fetched: string[];
  skipped: Array<{
    messageId: string;
    reason: string;
  }>;
};

const config = loadConfig();
const gmailStateFile = path.join(config.dataRoot, "gmail-message-state.json");
const intakeDir = path.join(config.dataRoot, "gmail-intake");

function hasGmailCredentials(): boolean {
  return Boolean(
    config.googleClientId &&
      config.googleClientSecret &&
      config.googleRefreshToken
  );
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractPlainText(payload?: GmailPayload): string {
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

async function readSeenMessageIds(): Promise<Set<string>> {
  try {
    const raw = await readFile(gmailStateFile, "utf8");
    const parsed = JSON.parse(raw) as { seenMessageIds?: string[] };
    return new Set(parsed.seenMessageIds ?? []);
  } catch {
    return new Set<string>();
  }
}

async function writeSeenMessageIds(ids: Set<string>): Promise<void> {
  await writeFile(
    gmailStateFile,
    JSON.stringify({ seenMessageIds: [...ids] }, null, 2)
  );
}

async function refreshAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.googleRefreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("No access token returned from Google.");
  }

  return payload.access_token;
}

async function listMatchingMessages(accessToken: string): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", config.gmailQuery);
  url.searchParams.set("maxResults", String(config.gmailMaxResults));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Gmail list failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GmailListResponse;
  return (payload.messages ?? []).map((message) => message.id);
}

async function fetchMessageBody(accessToken: string, messageId: string): Promise<string> {
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

  const payload = (await response.json()) as GmailMessageResponse;
  return extractPlainText(payload.payload);
}

export async function fetchStructuredGmailMessagesToIntake(): Promise<GmailFetchResult> {
  if (!hasGmailCredentials()) {
    return {
      enabled: false,
      fetchedCount: 0,
      skippedCount: 0,
      fetched: [],
      skipped: []
    };
  }

  await mkdir(config.dataRoot, { recursive: true });
  await mkdir(intakeDir, { recursive: true });

  const accessToken = await refreshAccessToken();
  const seenIds = await readSeenMessageIds();
  const messageIds = await listMatchingMessages(accessToken);
  const result: GmailFetchResult = {
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

    await writeFile(path.join(intakeDir, `${messageId}.txt`), body);
    seenIds.add(messageId);
    result.fetchedCount += 1;
    result.fetched.push(messageId);
  }

  await writeSeenMessageIds(seenIds);
  return result;
}
