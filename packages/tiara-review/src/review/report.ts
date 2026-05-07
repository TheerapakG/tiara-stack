import type { ConsolidatedReview } from "./types";

export const renderReviewReport = (review: ConsolidatedReview) => {
  const issues =
    review.issues.length === 0
      ? "None."
      : review.issues
          .map(
            (issue, index) => `${index + 1}. Severity: ${issue.severity}
   Type: ${issue.type}
   Location: ${issue.location ?? "unknown"}
   Issue: ${issue.issue}
   Evidence: ${issue.evidence}
   Suggested fix: ${issue.suggestedFix}`,
          )
          .join("\n\n");
  const rechecks =
    review.priorIssuesRechecked.length === 0
      ? "None."
      : review.priorIssuesRechecked
          .map(
            (recheck, index) => `${index + 1}. Prior issue: ${recheck.priorIssue}
   Status: ${recheck.status}
   Evidence: ${recheck.evidence}`,
          )
          .join("\n\n");
  const notes =
    review.reviewNotes.length === 0
      ? "- None."
      : review.reviewNotes.map((note) => `- ${note}`).join("\n");
  return `## Checkpointed Review Report

Base reviewed: ${review.baseReviewed}
Current checkpoint: ${review.currentCheckpoint}
Safety confidence: ${review.safetyConfidence}/5

### Issues

${issues}

### Prior Issues Rechecked

${rechecks}

### Review Notes

${notes}
`;
};
