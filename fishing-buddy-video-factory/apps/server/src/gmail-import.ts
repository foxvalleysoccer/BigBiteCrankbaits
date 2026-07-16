import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { parseStructuredEmailSubmission } from "./email-submission-parser.js";
import { fetchStructuredGmailMessagesToIntake, type GmailFetchResult } from "./gmail-poll.js";
import { saveSubmission } from "./submission-intake.js";

export type GmailImportResult = {
  fetch: GmailFetchResult;
  importedCount: number;
  skippedCount: number;
  imported: Array<{
    emailFile: string;
    submissionId: string;
  }>;
  skipped: Array<{
    emailFile: string;
    reason: string;
  }>;
};

const config = loadConfig();
const intakeDir = path.join(config.dataRoot, "gmail-intake");
const processedDir = path.join(config.dataRoot, "gmail-processed");
const rejectedDir = path.join(config.dataRoot, "gmail-rejected");

async function ensureDirectories(): Promise<void> {
  await mkdir(intakeDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  await mkdir(rejectedDir, { recursive: true });
}

export async function importStructuredEmailSubmissions(): Promise<GmailImportResult> {
  const fetch = await fetchStructuredGmailMessagesToIntake();
  await ensureDirectories();

  const files = await readdir(intakeDir);
  const result: GmailImportResult = {
    fetch,
    importedCount: 0,
    skippedCount: 0,
    imported: [],
    skipped: []
  };

  for (const file of files) {
    const sourcePath = path.join(intakeDir, file);
    const raw = await readFile(sourcePath, "utf8");
    const parsed = parseStructuredEmailSubmission(raw);

    if (!parsed) {
      const rejectedPath = path.join(rejectedDir, file);
      await rename(sourcePath, rejectedPath);
      result.skippedCount += 1;
      result.skipped.push({
        emailFile: file,
        reason: "Missing required structured markers."
      });
      continue;
    }

    const submission = await saveSubmission(parsed);
    const processedPath = path.join(processedDir, file);
    await rename(sourcePath, processedPath);

    result.importedCount += 1;
    result.imported.push({
      emailFile: file,
      submissionId: submission.id
    });
  }

  return result;
}
