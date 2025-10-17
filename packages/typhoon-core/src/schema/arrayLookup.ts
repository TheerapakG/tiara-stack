import {
  Array,
  HashMap,
  Option,
  ParseResult,
  pipe,
  Schema,
  SchemaAST,
} from "effect";

interface ArrayLookupSchema<
  Literals extends Array.NonEmptyReadonlyArray<SchemaAST.LiteralValue>,
> extends Schema.transformOrFail<
    typeof Schema.Number,
    Schema.Literal<Literals>
  > {
  readonly literals: Literals;
}

const makeArrayLookupClass = <
  Literals extends Array.NonEmptyReadonlyArray<SchemaAST.LiteralValue>,
>(
  literals: Literals,
) => {
  const reverseLookup = pipe(
    literals,
    Array.map((literal, index) => [literal, index] as const),
    HashMap.fromIterable,
  );

  return class extends Schema.transformOrFail(
    Schema.Number,
    Schema.Literal<Literals>(...literals),
    {
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
          HashMap.get(
            reverseLookup,
            literal as Array.ReadonlyArray.Infer<Literals>,
          ),
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
    },
  ) {
    static literals = literals;
  } as ArrayLookupSchema<Literals>;
};

const ArrayLookupSchema = <
  Literals extends Array.NonEmptyReadonlyArray<SchemaAST.LiteralValue>,
>(
  literals: Literals,
): ArrayLookupSchema<Literals> => makeArrayLookupClass(literals);

export { ArrayLookupSchema };
