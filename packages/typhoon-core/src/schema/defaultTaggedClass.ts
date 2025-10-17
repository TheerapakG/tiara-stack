import { pipe, Schema, Types } from "effect";

export const DefaultTaggedClass = <
  TaggedClass extends Schema.Schema.Any & {
    readonly _tag: string;
    readonly fields: Schema.Struct.Fields;
  },
  Self extends
    Schema.Schema.Type<TaggedClass> = Schema.Schema.Type<TaggedClass>,
  Tag extends TaggedClass["_tag"] = TaggedClass["_tag"],
  Fields extends TaggedClass["fields"] = TaggedClass["fields"],
  OmitFields extends Types.Simplify<Omit<Fields, "_tag">> &
    Schema.Struct.Fields = Types.Simplify<Omit<Fields, "_tag">> &
    Schema.Struct.Fields,
>(
  taggedClass: TaggedClass,
): Schema.Schema<
  Self,
  Schema.Struct.Encoded<OmitFields> & {
    readonly _tag?: Tag;
  },
  Schema.Schema.Context<TaggedClass>
> =>
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
      Schema.Struct.Encoded<Fields>,
      Schema.Struct.Encoded<OmitFields> & {
        readonly _tag?: Tag;
      }
    >,
    Schema.compose(
      taggedClass as Schema.Schema<
        Self,
        Schema.Struct.Encoded<Fields>,
        Schema.Schema.Context<TaggedClass>
      >,
    ),
  ) as Schema.Schema<
    Self,
    Schema.Struct.Encoded<OmitFields> & {
      readonly _tag?: Tag;
    },
    Schema.Schema.Context<TaggedClass>
  >;
