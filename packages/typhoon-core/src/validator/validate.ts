import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, Option } from "effect";
import { Observable } from "../observability";
import {
  type Output,
  Validator,
  validateOption as validateOptionWithValidator,
  validateSchemaOption as validateSchemaOptionWithValidator,
  validateSchemaWithDefault as validateSchemaWithDefaultWithValidator,
  validateSchema as validateSchemaWithValidator,
  validateWithDefault as validateWithDefaultWithValidator,
  validate as validateWithValidator,
} from "./validator";
import { Validation } from "~/error";

export const validateSchema = <Schema extends StandardSchemaV1>(
  schema: Schema,
  options?: Observable.ObservableOptions,
): ((
  value: unknown,
) => Effect.Effect<
  StandardSchemaV1.InferOutput<Schema>,
  Validation.ValidationError
>) =>
  validateSchemaWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateSchemaOption = <Schema extends StandardSchemaV1>(
  schema: Schema,
  options?: Observable.ObservableOptions,
): ((
  value: unknown,
) => Effect.Effect<Option.Option<StandardSchemaV1.InferOutput<Schema>>>) =>
  validateSchemaOptionWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateSchemaWithDefault = <
  Schema extends StandardSchemaV1,
  Output extends
    StandardSchemaV1.InferOutput<Schema> = StandardSchemaV1.InferOutput<Schema>,
>(
  schema: Schema,
  defaultValue: Output,
  options?: Observable.ObservableOptions,
): ((value: unknown) => Effect.Effect<Output>) =>
  validateSchemaWithDefaultWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
    defaultValue,
  );

export const validate = <Schema extends StandardSchemaV1 | undefined>(
  schema: Schema,
  options?: Observable.ObservableOptions,
): ((
  value: unknown,
) => Effect.Effect<Output<Schema>, Validation.ValidationError>) =>
  validateWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateOption = <Schema extends StandardSchemaV1 | undefined>(
  schema: Schema,
  options?: Observable.ObservableOptions,
): ((value: unknown) => Effect.Effect<Option.Option<Output<Schema>>>) =>
  validateOptionWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateWithDefault = <
  Schema extends StandardSchemaV1 | undefined,
>(
  schema: Schema,
  defaultValue: Schema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Schema>
    : unknown,
  options?: Observable.ObservableOptions,
): ((value: unknown) => Effect.Effect<Output<Schema>>) =>
  validateWithDefaultWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
    defaultValue,
  );
