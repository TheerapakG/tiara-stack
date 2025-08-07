import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, pipe } from "effect";
import {
  Observable,
  ObservableOptions,
  ObservableSymbol,
} from "../obsevability/observable";

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

export class Validator<Schema extends StandardSchemaV1 | undefined>
  extends Data.TaggedClass("Validator")<{
    [ObservableSymbol]: ObservableOptions;
    schema: Schema;
  }>
  implements Observable
{
  hasSchema(): this is Validator<Exclude<Schema, undefined>> {
    return this.schema !== undefined;
  }

  static validateSchema<
    Schema extends StandardSchemaV1,
    Output extends
      StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
  >(validator: Validator<Schema>) {
    return (value: unknown): Effect.Effect<Output, ValidationError> =>
      pipe(
        Effect.Do,
        Effect.let(
          "result",
          () =>
            validator.schema["~standard"].validate(value) as
              | StandardSchemaV1.Result<Output>
              | Promise<StandardSchemaV1.Result<Output>>,
        ),
        Effect.flatMap(({ result }) =>
          result instanceof Promise
            ? pipe(
                Effect.promise(() => result),
                Effect.flatMap(parseStandardSchemaV1Result),
              )
            : parseStandardSchemaV1Result<Output>(result),
        ),
        Observable.withSpan(validator, "Validator.validateSchema", {
          captureStackTrace: true,
        }),
      );
  }

  static validateSchemaWithDefault<
    Schema extends StandardSchemaV1,
    Output extends
      StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
  >(validator: Validator<Schema>, defaultValue: Output) {
    return (value: unknown): Effect.Effect<Output> =>
      pipe(
        value,
        Validator.validateSchema<Schema, Output>(validator),
        Effect.catchTag("ValidationError", () => Effect.succeed(defaultValue)),
        Observable.withSpan(validator, "Validator.validateSchemaWithDefault", {
          captureStackTrace: true,
        }),
      );
  }

  static validate<
    Schema extends StandardSchemaV1 | undefined,
    Output extends Validated<Schema> = Validated<Schema>,
  >(validator: Validator<Schema>) {
    return (value: unknown): Effect.Effect<Output, ValidationError> =>
      pipe(
        validator.hasSchema()
          ? (Validator.validateSchema(validator)(value) as Effect.Effect<
              Output,
              ValidationError
            >)
          : Effect.succeed(value as Output),
        Observable.withSpan(validator, "Validator.validate", {
          captureStackTrace: true,
        }),
      );
  }

  static validateWithDefault<
    Schema extends StandardSchemaV1 | undefined,
    Output extends Validated<Schema> = Validated<Schema>,
  >(validator: Validator<Schema>, defaultValue: Output) {
    return (value: unknown): Effect.Effect<Output> =>
      pipe(
        value,
        Validator.validate<Schema, Output>(validator),
        Effect.catchTag("ValidationError", () => Effect.succeed(defaultValue)),
        Observable.withSpan(validator, "Validator.validateWithDefault", {
          captureStackTrace: true,
        }),
      );
  }
}

export const validateSchema = <Schema extends StandardSchemaV1>(
  schema: Schema,
  options?: ObservableOptions,
) =>
  Validator.validateSchema(
    new Validator({ [ObservableSymbol]: options ?? {}, schema }),
  );

export const validateSchemaWithDefault = <
  Schema extends StandardSchemaV1,
  Output extends
    StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
>(
  schema: Schema,
  defaultValue: Output,
  options?: ObservableOptions,
) =>
  Validator.validateSchemaWithDefault(
    new Validator({ [ObservableSymbol]: options ?? {}, schema }),
    defaultValue,
  );

export const validate = <Schema extends StandardSchemaV1 | undefined>(
  schema: Schema,
  options?: ObservableOptions,
) =>
  Validator.validate(
    new Validator({ [ObservableSymbol]: options ?? {}, schema }),
  );

export const validateWithDefault = <
  Schema extends StandardSchemaV1 | undefined,
  Output extends Validated<Schema> = Validated<Schema>,
>(
  schema: Schema,
  defaultValue: Output,
  options?: ObservableOptions,
) =>
  Validator.validateWithDefault(
    new Validator({ [ObservableSymbol]: options ?? {}, schema }),
    defaultValue,
  );
