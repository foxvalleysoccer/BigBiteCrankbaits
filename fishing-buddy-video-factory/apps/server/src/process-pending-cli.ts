import { processPendingSubmissions } from "./process-pending-submissions.js";

async function main(): Promise<void> {
  const results = await processPendingSubmissions();

  if (results.length === 0) {
    console.log("No pending submissions found.");
    return;
  }

  for (const result of results) {
    console.log(
      `Processed ${result.id} for ${result.buddyName}: ${result.transitionedTo.join(" -> ")}`
    );
  }
}

main().catch((error) => {
  console.error("Failed to process pending submissions.");
  console.error(error);
  process.exitCode = 1;
});
