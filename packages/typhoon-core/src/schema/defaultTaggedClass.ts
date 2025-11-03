import { Option, pipe, Schema } from "effect";

type TaggedClass = Schema.Schema.Any & {
  readonly _tag: string;
  readonly fields: Schema.Struct.Fields & { _tag: Schema.tag<any> };
};

type Tag<Tagged extends TaggedClass> = Tagged["_tag"];
type Fields<Tagged extends TaggedClass> = Tagged["fields"];

export const DefaultTaggedClass = <Tagged extends TaggedClass>(
  taggedClass: Tagged,
): Schema.Schema<
  Schema.Schema.Type<Tagged>,
  Schema.Struct.Encoded<Omit<Fields<Tagged>, "_tag">> &
    Schema.Struct.Encoded<{
      _tag: Schema.PropertySignature<
        ":",
        Tag<Tagged>,
        never,
        "?:",
        Tag<Tagged>,
        false,
        never
      >;
    }>,
  Schema.Schema.Context<Tagged>
> =>
  pipe(
    pipe(
      Schema.Struct(taggedClass.fields).omit("_tag"),
      Schema.encodedSchema,
      Schema.extend(
        Schema.Struct({
          _tag: Schema.optionalToRequired(
            Schema.Literal(taggedClass._tag),
            Schema.Literal(taggedClass._tag),
            {
              decode: Option.getOrElse(() => taggedClass._tag),
              encode: (value) => Option.some(value),
            },
          ),
        }),
      ),
    ) as unknown as Schema.Schema<
      Schema.Struct.Encoded<Fields<Tagged>>,
      Schema.Struct.Encoded<Omit<Fields<Tagged>, "_tag">> &
        Schema.Struct.Encoded<{
          _tag: Schema.PropertySignature<
            ":",
            Tag<Tagged>,
            never,
            "?:",
            Tag<Tagged>,
            false,
            never
          >;
        }>
    >,
    Schema.compose(
      taggedClass as Schema.Schema<
        Schema.Schema.Type<Tagged>,
        Schema.Struct.Encoded<Fields<Tagged>>,
        Schema.Schema.Context<Tagged>
      >,
    ),
  );
