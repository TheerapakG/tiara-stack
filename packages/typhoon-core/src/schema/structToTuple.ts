import { Array, Tuple, pipe, Schema, Types } from "effect";

const TypeId: typeof Schema.TypeId = Schema.TypeId;
export { TypeId };

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

interface StructToTupleSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
> extends Schema.transform<
    Schema.Struct<Struct<Keys, Fields>>,
    Schema.Tuple<Fields>
  > {
  readonly keys: Keys;
  readonly fields: Fields;
}

const makeStructToTupleClass = <
  const Keys extends ReadonlyArray<string>,
  const Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
>(
  keys: Keys,
  fields: Fields,
) => {
  const TupleSchema = Schema.Tuple<Fields>(...fields);
  const StructSchema = Schema.Struct(
    Object.fromEntries(Array.zip(keys, fields)) as Struct<Keys, Fields>,
  );

  return class extends Schema.transform(StructSchema, TupleSchema, {
    strict: true,
    decode: (struct) =>
      pipe(
        keys,
        Tuple.map(
          (key) =>
            struct[key as keyof Schema.Struct.Type<Struct<Keys, Fields>>],
        ),
      ) as Schema.Schema.Encoded<typeof TupleSchema>,
    encode: (tuple) => pipe(Array.zip(keys, tuple), Object.fromEntries),
  }) {
    static keys = keys;
    static fields = fields;
  } as StructToTupleSchema<Keys, Fields>;
};

const StructToTupleSchema = <
  const Keys extends ReadonlyArray<string>,
  const Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
>(
  keys: Keys,
  fields: Fields,
): StructToTupleSchema<Keys, Fields> => makeStructToTupleClass(keys, fields);

export { StructToTupleSchema };
