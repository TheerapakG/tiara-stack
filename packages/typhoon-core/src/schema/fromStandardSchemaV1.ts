import { Effect, Schema, ParseResult, pipe } from "effect";
import { Validate } from "../validator";
import type { StandardSchemaV1 } from "@standard-schema/spec";

interface FromStandardSchemaV1Schema<S extends StandardSchemaV1>
  extends Schema.transformOrFail<
    Schema.Schema<StandardSchemaV1.InferOutput<S>>,
    Schema.Schema<StandardSchemaV1.InferInput<S>>
  > {}

const makeFromStandardSchemaV1Class = <S extends StandardSchemaV1>(
  schema: S,
) => {
  return class extends Schema.transformOrFail(
    Schema.declare((_input): _input is StandardSchemaV1.InferInput<S> => true),
    Schema.declare(
      (_output): _output is StandardSchemaV1.InferOutput<S> => true,
    ),
    {
      strict: true,
      decode: (input, _, ast) =>
        pipe(
          input,
          Validate.validateSchema(schema),
          Effect.catchTag("ValidationError", (error) =>
            ParseResult.fail(new ParseResult.Type(ast, input, error.message)),
          ),
        ),
      encode: (output, _, ast) =>
        ParseResult.fail(
          new ParseResult.Forbidden(ast, output, "Not implemented"),
        ),
    },
  ) {} as FromStandardSchemaV1Schema<S>;
};

const FromStandardSchemaV1 = <S extends StandardSchemaV1>(
  schema: S,
): FromStandardSchemaV1Schema<S> => makeFromStandardSchemaV1Class(schema);

export { FromStandardSchemaV1 };
