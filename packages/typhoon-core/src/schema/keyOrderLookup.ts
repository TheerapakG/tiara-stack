import { Array, HashMap, Option, ParseResult, pipe, Schema } from "effect";

interface KeyOrderLookupSchema<
  Keys extends ReadonlyArray<string | number | symbol>,
  Fields extends { readonly [x in Keys[number]]: Schema.Struct.Field },
> extends Schema.transformOrFail<
  Schema.Array$<Schema.Tuple<[typeof Schema.Number, typeof Schema.Unknown]>>,
  Schema.Struct<Fields>
> {
  readonly keys: Keys;
  readonly fields: Fields;
}

const makeKeyOrderLookupClass = <
  Keys extends ReadonlyArray<string | number | symbol>,
  Fields extends { readonly [x in Keys[number]]: Schema.Struct.Field },
>(
  keys: Keys,
  fields: Fields,
) => {
  const reverseLookup = pipe(
    keys,
    Array.map((key, index) => [key as string, index] as const),
    HashMap.fromIterable,
  );

  const StructSchema = Schema.Struct(fields);

  return class extends pipe(
    Schema.Array(Schema.Tuple(Schema.Number, Schema.Unknown)),
    Schema.transformOrFail(StructSchema, {
      strict: true,
      decode: (tuples, _, ast) => {
        const [issues, keyValuePairs] = pipe(
          tuples,
          Array.map(([index, value]) =>
            pipe(
              Array.get(keys, index),
              Option.match({
                onSome: (key) => ParseResult.succeed([key, value] as [Keys[number], unknown]),
                onNone: () =>
                  ParseResult.fail(
                    new ParseResult.Unexpected(index, `Index ${index} not found in keys array`),
                  ),
              }),
            ),
          ),
          Array.separate,
        );

        return pipe(
          issues,
          Array.match({
            onNonEmpty: (issues) =>
              ParseResult.fail(new ParseResult.Composite(ast, tuples, issues)),
            onEmpty: () =>
              pipe(
                keyValuePairs,
                Object.fromEntries,
                ParseResult.decodeUnknown(Schema.encodedSchema(StructSchema)),
              ),
          }),
        );
      },
      encode: (struct, _, ast) => {
        const [issues, indexValuePairs] = pipe(
          Object.entries(struct),
          Array.map(([key, value]) =>
            pipe(
              HashMap.get(reverseLookup, key),
              Option.match({
                onSome: (index) => ParseResult.succeed([index, value] as const),
                onNone: () =>
                  ParseResult.fail(
                    new ParseResult.Unexpected(key, `Key ${key} not found in keys array`),
                  ),
              }),
            ),
          ),
          Array.separate,
        );

        return pipe(
          issues,
          Array.match({
            onNonEmpty: (issues) =>
              ParseResult.fail(new ParseResult.Composite(ast, struct, issues)),
            onEmpty: () => ParseResult.succeed(indexValuePairs),
          }),
        );
      },
    }),
  ) {
    static keys = keys;
    static fields = fields;
  } as KeyOrderLookupSchema<Keys, Fields>;
};

const KeyOrderLookupSchema = <
  Keys extends ReadonlyArray<string | number | symbol>,
  Fields extends { readonly [x in Keys[number]]: Schema.Struct.Field },
>(
  keys: Keys,
  fields: Fields,
): KeyOrderLookupSchema<Keys, Fields> => makeKeyOrderLookupClass(keys, fields);

export { KeyOrderLookupSchema };
