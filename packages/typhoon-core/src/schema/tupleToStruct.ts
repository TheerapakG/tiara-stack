import { Array, pipe, Schema, Tuple, Types } from "effect";

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

type TupleToStructSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends Types.TupleOf<Keys["length"], Schema.Schema.Any>,
> = Schema.transform<Schema.Tuple<EncodedFields<Fields>>, Schema.Struct<Struct<Keys, Fields>>> & {
  readonly keys: Keys;
  readonly fields: Fields;
};

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
          (key) => struct[key as keyof Schema.Struct.Encoded<Struct<Keys, Fields>>] as unknown,
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

type StructValue<Keys extends ReadonlyArray<string>, Value extends Schema.Schema.Any> = {
  [K in Keys[number]]: Value;
};

type EncodedValues<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
> = Types.TupleOf<Keys["length"], Schema.SchemaClass<Schema.Schema.Encoded<Value>>>;

type TupleToStructValueSchema<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
> = Schema.transform<
  Schema.Tuple<EncodedValues<Keys, Value>>,
  Schema.Struct<StructValue<Keys, Value>>
> & {
  readonly keys: Keys;
  readonly value: Value;
};

const makeTupleToStructValueClass = <
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

  return class extends Schema.transform(TupleSchema, StructSchema, {
    strict: true,
    decode: (tuple) => pipe(Array.zip(keys, tuple), Object.fromEntries),
    encode: (struct) =>
      pipe(
        keys,
        Tuple.map(
          (key) => struct[key as keyof Schema.Struct.Encoded<StructValue<Keys, Value>>] as unknown,
        ),
      ) as Schema.Schema.Type<typeof TupleSchema>,
  }) {
    static keys = keys;
    static value = value;
  } as TupleToStructValueSchema<Keys, Value>;
};

const TupleToStructValueSchema = <
  const Keys extends ReadonlyArray<string>,
  const Value extends Schema.Schema.Any,
>(
  keys: Keys,
  value: Value,
): TupleToStructValueSchema<Keys, Value> => makeTupleToStructValueClass(keys, value);

export { TupleToStructSchema, TupleToStructValueSchema };
