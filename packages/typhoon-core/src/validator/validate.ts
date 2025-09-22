import { StandardSchemaV1 } from "@standard-schema/spec";
import { Observable } from "../observability";
import {
  ValidationError,
  Validator,
  validateOption as validateOptionWithValidator,
  validateSchemaOption as validateSchemaOptionWithValidator,
  validateSchemaWithDefault as validateSchemaWithDefaultWithValidator,
  validateSchema as validateSchemaWithValidator,
  validateWithDefault as validateWithDefaultWithValidator,
  validate as validateWithValidator,
} from "./validator";

export { ValidationError };

export const validateSchema = <Schema extends StandardSchemaV1>(
  schema: Schema,
  options?: Observable.ObservableOptions,
) =>
  validateSchemaWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateSchemaOption = <Schema extends StandardSchemaV1>(
  schema: Schema,
  options?: Observable.ObservableOptions,
) =>
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
) =>
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
) =>
  validateWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
  );

export const validateOption = <Schema extends StandardSchemaV1 | undefined>(
  schema: Schema,
  options?: Observable.ObservableOptions,
) =>
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
) =>
  validateWithDefaultWithValidator(
    new Validator({
      [Observable.ObservableSymbol]: options ?? {},
      schema,
    }),
    defaultValue,
  );
