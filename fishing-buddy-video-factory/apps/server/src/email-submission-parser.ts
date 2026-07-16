import type { FishingBuddySubmissionInput } from "./submission-intake.js";

function readMarkerBlock(body: string, startMarker: string, endMarker: string): string {
  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return "";
  }

  return body
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
}

function readSingleLineField(body: string, fieldName: string): string {
  const expression = new RegExp(`^${fieldName}:\\s*(.*)$`, "mi");
  const match = body.match(expression);
  return match?.[1]?.trim() ?? "";
}

export type ParsedEmailSubmission = FishingBuddySubmissionInput & {
  sourceSubmissionId: string;
};

export function parseStructuredEmailSubmission(body: string): ParsedEmailSubmission | null {
  const sourceSubmissionId = readSingleLineField(body, "SUBMISSION_ID");
  const requesterName = readSingleLineField(body, "REQUESTER_NAME");
  const requesterEmail = readSingleLineField(body, "REQUESTER_EMAIL");
  const buddyName = readSingleLineField(body, "BUDDY_NAME");
  const musicStyle = readSingleLineField(body, "MUSIC_STYLE");
  const roastLevel = readSingleLineField(body, "ROAST_LEVEL");
  const lakeName = readSingleLineField(body, "LAKE_NAME");
  const storyDetails = readMarkerBlock(body, "STORY_BEGIN", "STORY_END");
  const extraDetails = readMarkerBlock(body, "EXTRA_NOTES_BEGIN", "EXTRA_NOTES_END");
  const consentAccepted = readSingleLineField(body, "CONSENT_ACCEPTED").toUpperCase() === "YES";

  if (
    !sourceSubmissionId ||
    !requesterName ||
    !requesterEmail ||
    !buddyName ||
    !musicStyle ||
    !roastLevel ||
    !storyDetails ||
    !consentAccepted
  ) {
    return null;
  }

  return {
    sourceSubmissionId,
    requesterName,
    requesterEmail,
    buddyName,
    musicStyle,
    roastLevel,
    lakeName,
    storyDetails,
    extraDetails,
    consentAccepted
  };
}
