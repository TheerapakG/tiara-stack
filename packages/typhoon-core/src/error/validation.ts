import { Cause, Data } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationErrorData = {
  issues: readonly StandardSchemaV1.Issue[];
  message: string;
};
const ValidationErrorTaggedError: new (
  args: Readonly<ValidationErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "ValidationError";
} & Readonly<ValidationErrorData> = Data.TaggedError("ValidationError")<{
  issues: readonly StandardSchemaV1.Issue[];
  message: string;
}>;
export class ValidationError extends ValidationErrorTaggedError {}

export const makeValidationError = (
  issues: readonly StandardSchemaV1.Issue[],
) =>
  new ValidationError({
    issues,
    message: `Validation failed: ${issues.map((issue) => issue.message).join(", ")}`,
  });
