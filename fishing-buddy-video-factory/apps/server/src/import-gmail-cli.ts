import { importStructuredEmailSubmissions } from "./gmail-import.js";

async function main(): Promise<void> {
  const result = await importStructuredEmailSubmissions();

  console.log(`Imported: ${result.importedCount}`);
  console.log(`Skipped: ${result.skippedCount}`);

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
