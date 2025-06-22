import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, pipe } from "effect";

export type Validated<Schema extends StandardSchemaV1 | undefined> =
  Schema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Schema>
    : unknown;

export class ValidationError extends Data.TaggedError("ValidationError")<{
  issues: readonly StandardSchemaV1.Issue[];
  message: string;
}> {
  constructor({
    issues,
  }: {
    readonly issues: readonly StandardSchemaV1.Issue[];
  }) {
    super({ issues, message: issues.map((issue) => issue.message).join("\n") });
  }
}

const parseStandardSchemaV1Result = <Output = unknown>(
  result: StandardSchemaV1.Result<Output>,
): Effect.Effect<Output, ValidationError> => {
  return result.issues
    ? Effect.fail(new ValidationError({ issues: result.issues }))
    : Effect.succeed(result.value);
};

export const validateSchema =
  <Schema extends StandardSchemaV1>(schema: Schema) =>
  (
    value: unknown,
  ): Effect.Effect<StandardSchemaV1.InferOutput<Schema>, ValidationError> => {
    const result = schema["~standard"].validate(value) as
      | StandardSchemaV1.Result<StandardSchemaV1.InferOutput<Schema>>
      | Promise<StandardSchemaV1.Result<StandardSchemaV1.InferOutput<Schema>>>;

    if (result instanceof Promise) {
      return pipe(
        Effect.promise(() => result),
        Effect.flatMap(parseStandardSchemaV1Result),
      );
    }

    return parseStandardSchemaV1Result<StandardSchemaV1.InferOutput<Schema>>(
      result,
    );
  };

export const validate =
  <Schema extends StandardSchemaV1 | undefined>(schema: Schema) =>
  (value: unknown): Effect.Effect<Validated<Schema>, ValidationError> => {
    if (!schema) return Effect.succeed(value as Validated<Schema>);
    return validateSchema(schema)(value) as Effect.Effect<
      Validated<Schema>,
      ValidationError
    >;
  };
