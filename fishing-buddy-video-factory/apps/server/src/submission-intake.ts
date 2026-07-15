import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import type { SubmissionRecord } from "./workflow-state.js";

export type FishingBuddySubmissionInput = {
  requesterName: string;
  requesterEmail: string;
  buddyName: string;
  musicStyle: string;
  roastLevel: string;
  lakeName?: string;
  storyDetails: string;
  extraDetails?: string;
  consentAccepted: boolean;
};

type SubmissionStore = {
  submissions: SubmissionRecord[];
};

const config = loadConfig();
const submissionsFile = path.join(config.dataRoot, "submissions.json");

function buildSubmissionId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FB-${stamp}-${random}`;
}

async function ensureStore(): Promise<SubmissionStore> {
  await mkdir(config.dataRoot, { recursive: true });

  try {
    const raw = await readFile(submissionsFile, "utf8");
    return JSON.parse(raw) as SubmissionStore;
  } catch (error) {
    return { submissions: [] };
  }
}

async function saveStore(store: SubmissionStore): Promise<void> {
  await writeFile(submissionsFile, JSON.stringify(store, null, 2));
}

export async function saveSubmission(
  input: FishingBuddySubmissionInput
): Promise<SubmissionRecord> {
  const store = await ensureStore();
  const now = new Date().toISOString();

  const submission: SubmissionRecord = {
    id: buildSubmissionId(),
    requesterName: input.requesterName.trim(),
    requesterEmail: input.requesterEmail.trim(),
    buddyName: input.buddyName.trim(),
    musicStyle: input.musicStyle.trim(),
    roastLevel: input.roastLevel.trim(),
    lakeName: (input.lakeName ?? "").trim(),
    storyDetails: input.storyDetails.trim(),
    extraDetails: (input.extraDetails ?? "").trim(),
    state: "RECEIVED",
    createdAt: now
  };

  store.submissions.push(submission);
  await saveStore(store);
  return submission;
}

export async function listPendingSubmissions(): Promise<SubmissionRecord[]> {
  const store = await ensureStore();
  return store.submissions.filter((submission) => submission.state === "RECEIVED");
}
