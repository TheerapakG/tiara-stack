import { pipe, Schema, SchemaAST } from "effect";

export const DefaultTaggedStruct = <
  Tag extends SchemaAST.LiteralValue,
  Fields extends Schema.Struct.Fields,
>(
  tag: Tag,
  fields: Fields,
) =>
  Schema.Struct({
    _tag: pipe(
      Schema.Literal(tag),
      Schema.optional,
      Schema.withDefaults({
        constructor: () => tag,
        decoding: () => tag,
      }),
    ),
    ...fields,
  });
