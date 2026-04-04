import { pipe, Schema, SchemaAST, SchemaGetter, Struct } from "effect";

type TaggedClass = Schema.Top & {
  readonly fields: Schema.Struct.Fields & { _tag: Schema.tag<SchemaAST.LiteralValue> };
};

type Tag<Tagged extends TaggedClass> = Schema.Schema.Type<Tagged["fields"]["_tag"]>;
type Fields<Tagged extends TaggedClass> = Tagged["fields"];

type DefaultTaggedClassType<Tagged extends TaggedClass> = Schema.Schema.Type<Tagged>;
type DefaultTaggedClassEncoded<Tagged extends TaggedClass> = Schema.Struct.Encoded<
  Omit<Fields<Tagged>, "_tag">
> &
  Schema.Struct.Encoded<{
    _tag: Schema.optional<Schema.Literal<Tag<Tagged>>>;
  }> extends infer B
  ? B
  : never;
type DefaultTaggedClass<Tagged extends TaggedClass> = Schema.Codec<
  DefaultTaggedClassType<Tagged>,
  DefaultTaggedClassEncoded<Tagged>,
  Schema.Codec.DecodingServices<Tagged>,
  Schema.Codec.EncodingServices<Tagged>
>;

export const DefaultTaggedClass = <Tagged extends TaggedClass>(
  taggedClass: Tagged,
): DefaultTaggedClass<Tagged> =>
  pipe(
    Schema.Struct(taggedClass.fields).mapFields(
      Struct.assign({
        _tag: Schema.optional(Schema.Literal(taggedClass.fields._tag.schema.literal)).pipe(
          Schema.withDecodingDefault(() => taggedClass.fields._tag.schema.literal),
        ),
      }),
    ),
    Schema.toEncoded,
    Schema.decodeTo(taggedClass, {
      decode: SchemaGetter.passthrough(),
      encode: SchemaGetter.passthroughSupertype(),
    }),
  ) as unknown as DefaultTaggedClass<Tagged>;
