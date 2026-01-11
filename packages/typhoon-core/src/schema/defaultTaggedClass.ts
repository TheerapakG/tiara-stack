import { Option, pipe, Schema } from "effect";

type TaggedClass = Schema.Schema.Any & {
  readonly _tag: string;
  readonly fields: Schema.Struct.Fields & { _tag: Schema.tag<any> };
};

type Tag<Tagged extends TaggedClass> = Tagged["_tag"];
type Fields<Tagged extends TaggedClass> = Tagged["fields"];

type DefaultTaggedClassType<Tagged extends TaggedClass> = Schema.Schema.Type<Tagged>;
type DefaultTaggedClassEncoded<Tagged extends TaggedClass> = Schema.Struct.Encoded<
  Omit<Fields<Tagged>, "_tag">
> &
  Schema.Struct.Encoded<{
    _tag: Schema.PropertySignature<":", Tag<Tagged>, never, "?:", Tag<Tagged>, false, never>;
  }> extends infer B
  ? B
  : never;
type DefaultTaggedClassContext<Tagged extends TaggedClass> = Schema.Schema.Context<Tagged>;
type DefaultTaggedClass<Tagged extends TaggedClass> = Schema.Schema<
  DefaultTaggedClassType<Tagged>,
  DefaultTaggedClassEncoded<Tagged>,
  DefaultTaggedClassContext<Tagged>
>;

export const DefaultTaggedClass = <Tagged extends TaggedClass>(
  taggedClass: Tagged,
): DefaultTaggedClass<Tagged> =>
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
      DefaultTaggedClassEncoded<Tagged>
    >,
    Schema.compose(
      taggedClass as Schema.Schema<
        DefaultTaggedClassType<Tagged>,
        Schema.Struct.Encoded<Fields<Tagged>>,
        DefaultTaggedClassContext<Tagged>
      >,
    ),
  ) as DefaultTaggedClass<Tagged>;
