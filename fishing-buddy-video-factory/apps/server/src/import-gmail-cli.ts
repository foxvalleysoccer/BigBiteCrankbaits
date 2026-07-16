import { importStructuredEmailSubmissions } from "./gmail-import.js";

async function main(): Promise<void> {
  const result = await importStructuredEmailSubmissions();

  console.log(`Gmail polling enabled: ${result.fetch.enabled}`);
  console.log(`Fetched from Gmail: ${result.fetch.fetchedCount}`);
  console.log(`Imported: ${result.importedCount}`);
  console.log(`Skipped: ${result.skippedCount}`);

  for (const fetched of result.fetch.fetched) {
    console.log(`Fetched Gmail message ${fetched}`);
  }

  for (const skippedFetch of result.fetch.skipped) {
    console.log(`Skipped Gmail message ${skippedFetch.messageId}: ${skippedFetch.reason}`);
  }

  for (const imported of result.imported) {
    console.log(`Imported ${imported.emailFile} -> ${imported.submissionId}`);
  }

  for (const skipped of result.skipped) {
    console.log(`Skipped ${skipped.emailFile}: ${skipped.reason}`);
  }
}

main().catch((error) => {
  console.error("Failed to import Gmail-style submissions.");
  console.error(error);
  process.exitCode = 1;
});
