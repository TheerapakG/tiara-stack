import { Array, Tuple, pipe, Schema, Types } from "effect";

const StructToTupleTypeId: typeof Schema.TypeId = Schema.TypeId;
export { StructToTupleTypeId };

type StructHelper<
  A extends ReadonlyArray<string>,
  B extends ReadonlyArray<Schema.Schema.Any>,
> = A extends readonly [infer AHead extends string, ...infer ATail extends ReadonlyArray<string>]
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

type EncodedFields<Fields extends ReadonlyArray<Schema.Schema.Any>> = Fields extends readonly [
  infer Head extends Schema.Schema.Any,
  ...infer Tail extends ReadonlyArray<Schema.Schema.Any>,
]
  ? [Schema.SchemaClass<Schema.Schema.Encoded<Head>>, ...EncodedFields<Tail>]
  : [];

type StructToTupleSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
> = Schema.transform<Schema.Struct<Struct<Keys, Fields>>, Schema.Tuple<EncodedFields<Fields>>> & {
  readonly keys: Keys;
  readonly fields: Fields;
};

const makeStructToTupleClass = <
  const Keys extends ReadonlyArray<string>,
  const Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
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

  return class extends Schema.transform(StructSchema, TupleSchema, {
    strict: true,
    decode: (struct) =>
      pipe(
        keys,
        Tuple.map((key) => struct[key as keyof Schema.Struct.Type<Struct<Keys, Fields>>]),
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

type StructValue<Keys extends ReadonlyArray<string>, Value extends Schema.Schema.Any> = {
  [K in Keys[number]]: Value;
};

type EncodedValues<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
> = Types.TupleOf<Keys["length"], Schema.SchemaClass<Schema.Schema.Encoded<Value>>>;

type StructToTupleValueSchema<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
> = Schema.transform<
  Schema.Struct<StructValue<Keys, Value>>,
  Schema.Tuple<EncodedValues<Keys, Value>>
> & {
  readonly keys: Keys;
  readonly value: Value;
};

const makeStructToTupleValueClass = <
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
>(
  keys: Keys,
  value: Value,
) => {
  const TupleSchema = Schema.Tuple<EncodedValues<Keys, Value>>(
    ...(Array.makeBy(keys.length, () => Schema.encodedSchema(value)) as EncodedValues<Keys, Value>),
  );
  const StructSchema = Schema.Struct(
    Object.fromEntries(
      pipe(
        keys,
        Array.map((key) => [key, value]),
      ),
    ) as StructValue<Keys, Value>,
  );

  return class extends Schema.transform(StructSchema, TupleSchema, {
    strict: true,
    decode: (struct) =>
      pipe(
        keys,
        Tuple.map((key) => struct[key as keyof Schema.Struct.Type<StructValue<Keys, Value>>]),
      ) as Schema.Schema.Encoded<typeof TupleSchema>,
    encode: (tuple) => pipe(Array.zip(keys, tuple), Object.fromEntries),
  }) {
    static keys = keys;
    static value = value;
  } as StructToTupleValueSchema<Keys, Value>;
};

const StructToTupleValueSchema = <
  const Keys extends ReadonlyArray<string>,
  const Value extends Schema.Schema.Any,
>(
  keys: Keys,
  value: Value,
): StructToTupleValueSchema<Keys, Value> => makeStructToTupleValueClass(keys, value);

export { StructToTupleSchema, StructToTupleValueSchema };
