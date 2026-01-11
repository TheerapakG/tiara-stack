import { Array, Effect, pipe, ParseResult, Schema } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

const StandardSchemaV1PathSegmentData = Schema.Struct({
  key: Schema.PropertyKey,
});

const StandardSchemaV1IssueData = Schema.Struct({
  message: Schema.String,
  path: Schema.optionalWith(
    Schema.Array(Schema.Union(Schema.PropertyKey, StandardSchemaV1PathSegmentData)),
    { nullable: true },
  ),
});

const ValidationErrorData = Schema.Struct({
  issues: Schema.Array(StandardSchemaV1IssueData),
  message: Schema.String,
});
const ValidationErrorTaggedError: Schema.TaggedErrorClass<
  ValidationError,
  "ValidationError",
  {
    readonly _tag: Schema.tag<"ValidationError">;
  } & (typeof ValidationErrorData)["fields"]
> = Schema.TaggedError<ValidationError>()("ValidationError", ValidationErrorData);
export class ValidationError extends ValidationErrorTaggedError {}

export const makeValidationError = (issues: readonly StandardSchemaV1.Issue[]) =>
  new ValidationError({
    issues,
    message: `Validation failed: ${issues.map((issue) => issue.message).join(", ")}`,
  });

export const makeValidationErrorFromParseError = (error: ParseResult.ParseError) =>
  pipe(
    ParseResult.ArrayFormatter.formatIssue(error.issue),
    Effect.map(
      Array.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    ),
    Effect.map(makeValidationError),
  );

export const catchParseErrorAsValidationError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, Exclude<E, ParseResult.ParseError> | ValidationError, R> =>
  pipe(
    effect,
    Effect.catchTag("ParseError" as unknown as never, (error) =>
      Effect.flip(makeValidationErrorFromParseError(error as unknown as ParseResult.ParseError)),
    ),
  ) as Effect.Effect<A, Exclude<E, ParseResult.ParseError> | ValidationError, R>;
