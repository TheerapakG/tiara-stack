#!/usr/bin/env node

export { runCheckpointedReview, runCheckpointedReviewWithClient } from "./review/workflow";
export {
  type Checkpoint,
  type ReviewRunConfig,
  type ReviewRunResult,
  type ReviewFinding,
  type ReviewAspect,
  type SafetyConfidence,
  type ExternalReviewImportResult,
} from "./review/types";
export { parseExternalReviewWithCodex } from "./review/external-review";
export { command, main, runMain } from "./cli";
import { runMain } from "./cli";

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  runMain();
}
