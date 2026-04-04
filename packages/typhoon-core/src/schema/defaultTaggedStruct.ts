import { Schema, SchemaAST, Struct } from "effect";

export const DefaultTaggedStruct = <
  Tag extends SchemaAST.LiteralValue,
  Fields extends Schema.Struct.Fields,
>(
  tag: Tag,
  fields: Fields,
) =>
  Schema.Struct(fields).mapFields(
    Struct.assign({
      _tag: Schema.optional(Schema.Literal(tag)).pipe(Schema.withDecodingDefault(() => tag)),
    }),
  );
