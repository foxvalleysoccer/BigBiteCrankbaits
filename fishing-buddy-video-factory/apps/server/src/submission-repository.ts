import type { SubmissionRecord } from "./workflow-state.js";
import { listPendingSubmissions } from "./submission-intake.js";

export class SubmissionRepository {
  async listPending(): Promise<SubmissionRecord[]> {
    return listPendingSubmissions();
  }
}
