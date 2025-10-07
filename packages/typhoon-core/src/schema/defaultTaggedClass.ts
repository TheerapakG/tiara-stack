import { pipe, Schema } from "effect";

export const DefaultTaggedClass = <
  Self,
  Tag extends string,
  Fields extends { readonly _tag: Schema.tag<Tag> } & Schema.Struct.Fields,
>(
  taggedClass: Schema.TaggedClass<Self, Tag, Fields>,
) =>
  pipe(
    Schema.extend(
      Schema.encodedSchema(Schema.Struct(taggedClass.fields).omit("_tag")),
      Schema.Struct({
        _tag: pipe(
          Schema.Literal(taggedClass._tag),
          Schema.optional,
          Schema.withDefaults({
            constructor: () => taggedClass._tag,
            decoding: () => taggedClass._tag,
          }),
        ),
      }),
    ) as unknown as Schema.Schema<
      Schema.Schema.Encoded<Schema.Struct<Fields>>,
      Schema.Schema.Encoded<Schema.Struct<Omit<Fields, "_tag">>> & {
        readonly _tag?: Tag;
      },
      never
    >,
    Schema.compose(taggedClass),
  );
