import type { SubmissionRecord, WorkflowState } from "./workflow-state.js";
import { SubmissionRepository } from "./submission-repository.js";

type ProcessedSubmission = SubmissionRecord & {
  transitionedTo: WorkflowState[];
};

const transitionPath: WorkflowState[] = [
  "VALIDATING",
  "LYRICS_GENERATING",
  "SUNO_PENDING",
  "SONGS_READY",
  "CLIPS_SELECTING",
  "VIDEOS_RENDERING",
  "FINAL_REVIEW_READY"
];

export async function processPendingSubmissions(): Promise<ProcessedSubmission[]> {
  const repository = new SubmissionRepository();
  const pending = await repository.listPending();

  return pending.map((submission) => ({
    ...submission,
    transitionedTo: transitionPath
  }));
}
