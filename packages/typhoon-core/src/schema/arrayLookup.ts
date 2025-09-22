import {
  Array,
  HashMap,
  Option,
  ParseResult,
  pipe,
  Schema,
  SchemaAST,
} from "effect";

export const ArrayLookupSchema = <LiteralValue extends SchemaAST.LiteralValue>(
  literals: Array.NonEmptyReadonlyArray<LiteralValue>,
) => {
  const reverseLookup = pipe(
    literals,
    Array.map((literal, index) => [literal, index] as const),
    HashMap.fromIterable,
  );

  return pipe(
    Schema.Number,
    Schema.transformOrFail(Schema.Literal(...literals), {
      strict: true,
      decode: (index) =>
        pipe(
          Array.get(literals, index),
          Option.match({
            onSome: ParseResult.succeed,
            onNone: () =>
              ParseResult.fail(
                new ParseResult.Unexpected(
                  index,
                  `Index ${index} not found in literals array`,
                ),
              ),
          }),
        ),
      encode: (literal) =>
        pipe(
          HashMap.get(reverseLookup, literal),
          Option.match({
            onSome: ParseResult.succeed,
            onNone: () =>
              ParseResult.fail(
                new ParseResult.Unexpected(
                  literal,
                  `Literal ${literal} not found in literals array`,
                ),
              ),
          }),
        ),
    }),
  );
};
