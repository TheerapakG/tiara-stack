import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, Option, pipe } from "effect";
import { Observable } from "../observability";
import { ValidationError, makeValidationError } from "~/error";

export type Input<Schema extends StandardSchemaV1 | undefined> = Schema extends StandardSchemaV1
  ? StandardSchemaV1.InferInput<Schema>
  : unknown;

export type Output<Schema extends StandardSchemaV1 | undefined> = Schema extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<Schema>
  : unknown;

const parseStandardSchemaV1Result = <Output = unknown>(
  result: StandardSchemaV1.Result<Output>,
): Effect.Effect<Output, ValidationError> => {
  return result.issues
    ? Effect.fail(makeValidationError(result.issues))
    : Effect.succeed(result.value);
};

type ValidatorData<Schema extends StandardSchemaV1 | undefined> = {
  [Observable.ObservableSymbol]: Observable.ObservableOptions;
  schema: Schema;
};
const ValidatorTaggedClass: new <Schema extends StandardSchemaV1 | undefined>(
  args: Readonly<ValidatorData<Schema>>,
) => Readonly<ValidatorData<Schema>> & { readonly _tag: "Validator" } =
  Data.TaggedClass("Validator");
export class Validator<Schema extends StandardSchemaV1 | undefined>
  extends ValidatorTaggedClass<Schema>
  implements Observable.Observable {}

export const hasSchema = <Schema extends StandardSchemaV1 | undefined>(
  validator: Validator<Schema>,
): validator is Validator<Exclude<Schema, undefined>> => validator.schema !== undefined;

export const validateSchema =
  <
    Schema extends StandardSchemaV1,
    Output extends StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
  >(
    validator: Validator<Schema>,
  ) =>
  (value: unknown): Effect.Effect<Output, ValidationError> =>
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

export const validateSchemaOption =
  <
    Schema extends StandardSchemaV1,
    Output extends StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
  >(
    validator: Validator<Schema>,
  ) =>
  (value: unknown): Effect.Effect<Option.Option<Output>> =>
    pipe(
      value,
      validateSchema<Schema, Output>(validator),
      Effect.map(Option.some),
      Effect.catchTag("ValidationError", () => Effect.succeedNone),
      Observable.withSpan(validator, "Validator.validateSchemaOption", {
        captureStackTrace: true,
      }),
    );

export const validateSchemaWithDefault =
  <
    Schema extends StandardSchemaV1,
    Output extends StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
  >(
    validator: Validator<Schema>,
    defaultValue: Output,
  ) =>
  (value: unknown): Effect.Effect<Output> =>
    pipe(
      value,
      validateSchema<Schema, Output>(validator),
      Effect.catchTag("ValidationError", () => Effect.succeed(defaultValue)),
      Observable.withSpan(validator, "Validator.validateSchemaWithDefault", {
        captureStackTrace: true,
      }),
    );

export const validate =
  <Schema extends StandardSchemaV1 | undefined, Out extends Output<Schema> = Output<Schema>>(
    validator: Validator<Schema>,
  ) =>
  (value: unknown): Effect.Effect<Out, ValidationError> =>
    pipe(
      hasSchema(validator)
        ? (validateSchema(validator)(value) as Effect.Effect<Out, ValidationError>)
        : Effect.succeed(value as Out),
      Observable.withSpan(validator, "Validator.validate", {
        captureStackTrace: true,
      }),
    );

export const validateOption =
  <Schema extends StandardSchemaV1 | undefined, Out extends Output<Schema> = Output<Schema>>(
    validator: Validator<Schema>,
  ) =>
  (value: unknown): Effect.Effect<Option.Option<Out>> =>
    pipe(
      value,
      validate<Schema, Out>(validator),
      Effect.map(Option.some),
      Effect.catchTag("ValidationError", () => Effect.succeedNone),
      Observable.withSpan(validator, "Validator.validateOption", {
        captureStackTrace: true,
      }),
    );

export const validateWithDefault =
  <Schema extends StandardSchemaV1 | undefined, Out extends Output<Schema> = Output<Schema>>(
    validator: Validator<Schema>,
    defaultValue: Out,
  ) =>
  (value: unknown): Effect.Effect<Out> =>
    pipe(
      value,
      validate<Schema, Out>(validator),
      Effect.catchTag("ValidationError", () => Effect.succeed(defaultValue)),
      Observable.withSpan(validator, "Validator.validateWithDefault", {
        captureStackTrace: true,
      }),
    );
