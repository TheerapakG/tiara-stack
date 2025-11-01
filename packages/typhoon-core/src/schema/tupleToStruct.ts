import { Array, pipe, Schema, Tuple, Types } from "effect";

type StructHelper<
  A extends ReadonlyArray<string>,
  B extends ReadonlyArray<Schema.Schema.Any>,
> = A extends readonly [
  infer AHead extends string,
  ...infer ATail extends ReadonlyArray<string>,
]
  ? B extends readonly [
      infer BHead extends Schema.Schema.All,
      ...infer BTail extends ReadonlyArray<Schema.Schema.Any>,
    ]
    ? { [K in AHead]: BHead } & StructHelper<ATail, BTail>
    : {}
  : {};

type Struct<
  Keys extends ReadonlyArray<string>,
  Fields extends ReadonlyArray<Schema.Schema.Any>,
> = StructHelper<Keys, Fields>;

type EncodedFields<Fields extends ReadonlyArray<Schema.Schema.Any>> =
  Fields extends readonly [
    infer Head extends Schema.Schema.Any,
    ...infer Tail extends ReadonlyArray<Schema.Schema.Any>,
  ]
    ? [Schema.Schema.Encoded<Head>, ...EncodedFields<Tail>]
    : [];

interface TupleToStructSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
> extends Schema.transform<
    Schema.Tuple<EncodedFields<Fields>>,
    Schema.Struct<Struct<Keys, Fields>>
  > {
  readonly keys: Keys;
  readonly fields: Fields;
}

const makeTupleToStructClass = <
  Keys extends ReadonlyArray<string>,
  Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
>(
  keys: Keys,
  fields: Fields,
) => {
  const TupleSchema = Schema.Tuple<EncodedFields<Fields>>(
    ...(pipe(fields, Array.map(Schema.encodedSchema)) as EncodedFields<Fields>),
  );
  const StructSchema = Schema.Struct(
    Object.fromEntries(Array.zip(keys, fields)) as Struct<Keys, Fields>,
  );

  return class extends Schema.transform(TupleSchema, StructSchema, {
    strict: true,
    decode: (tuple) => pipe(Array.zip(keys, tuple), Object.fromEntries),
    encode: (struct) =>
      pipe(
        keys,
        Tuple.map(
          (key) =>
            struct[
              key as keyof Schema.Struct.Encoded<Struct<Keys, Fields>>
            ] as unknown,
        ),
      ) as Schema.Schema.Type<typeof TupleSchema>,
  }) {
    static keys = keys;
    static fields = fields;
  } as TupleToStructSchema<Keys, Fields>;
};

const TupleToStructSchema = <
  const Keys extends ReadonlyArray<string>,
  const Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
>(
  keys: Keys,
  fields: Fields,
): TupleToStructSchema<Keys, Fields> => makeTupleToStructClass(keys, fields);

export { TupleToStructSchema };
