import { Effect, pipe, Schema, SchemaIssue } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type SchemaErrorLike = {
  readonly _tag: "SchemaError";
  readonly issue: unknown;
};

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()("ValidationError", {
  issues: Schema.Array(
    Schema.Struct({
      message: Schema.String,
      path: Schema.optional(
        Schema.Array(
          Schema.Union([
            Schema.PropertyKey,
            Schema.Struct({
              key: Schema.PropertyKey,
            }),
          ]),
        ),
      ),
    }),
  ),
  message: Schema.String,
}) {}

export const makeValidationError = (failure: StandardSchemaV1.FailureResult) =>
  new ValidationError({
    issues: failure.issues,
    message: `Validation failed: ${failure.issues.map((issue) => issue.message).join(", ")}`,
  });

export const makeValidationErrorFromSchemaError = (error: Schema.SchemaError) =>
  pipe(error.issue, SchemaIssue.makeFormatterStandardSchemaV1(), makeValidationError);

export const catchSchemaErrorAsValidationError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, Exclude<E, SchemaErrorLike> | ValidationError, R> =>
  pipe(
    effect,
    Effect.catchTag("SchemaError" as unknown as never, (error) =>
      Effect.fail(makeValidationErrorFromSchemaError(error as unknown as Schema.SchemaError)),
    ),
  ) as Effect.Effect<A, Exclude<E, SchemaErrorLike> | ValidationError, R>;
