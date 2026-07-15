import type { SubmissionRecord } from "./workflow-state.js";

export class SubmissionRepository {
  async listPending(): Promise<SubmissionRecord[]> {
    return [
      {
        id: "FB-DEMO-0001",
        buddyName: "Demo Buddy",
        musicStyle: "Country Roast",
        state: "RECEIVED"
      }
    ];
  }
}
