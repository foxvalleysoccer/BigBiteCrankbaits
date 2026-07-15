export const workflowStates = [
  "RECEIVED",
  "VALIDATING",
  "LYRICS_GENERATING",
  "SUNO_PENDING",
  "SONGS_READY",
  "CLIPS_SELECTING",
  "VIDEOS_RENDERING",
  "FINAL_REVIEW_READY",
  "FAILED_RETRYABLE",
  "FAILED_MANUAL"
] as const;

export type WorkflowState = (typeof workflowStates)[number];

export type SubmissionRecord = {
  id: string;
  buddyName: string;
  musicStyle: string;
  state: WorkflowState;
};
