import { Array, pipe, Record, Schema, SchemaGetter, Struct, Tuple } from "effect";

type ReadonlyTupleOf_<
  T,
  N extends number,
  R extends ReadonlyArray<unknown>,
> = `${N}` extends `-${number}`
  ? never
  : R["length"] extends N
    ? R
    : ReadonlyTupleOf_<T, N, [T, ...R]>;
type ReadonlyTupleOf<N extends number, T> = N extends N
  ? number extends N
    ? ReadonlyArray<T>
    : ReadonlyTupleOf_<T, N, []>
  : never;

type StructSchemaHelper<
  A extends ReadonlyArray<string>,
  B extends ReadonlyArray<Schema.Top>,
> = A extends readonly [infer AHead extends string, ...infer ATail extends ReadonlyArray<string>]
  ? B extends readonly [
      infer BHead extends Schema.Top,
      ...infer BTail extends ReadonlyArray<Schema.Top>,
    ]
    ? { [K in AHead]: BHead } & StructSchemaHelper<ATail, BTail>
    : {}
  : {};

type StructSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends ReadonlyArray<Schema.Top>,
> = StructSchemaHelper<Keys, Fields>;

type TupleFieldsSchema<Fields extends ReadonlyArray<Schema.Top>> = Fields extends readonly [
  infer Head extends Schema.Top,
  ...infer Tail extends ReadonlyArray<Schema.Top>,
]
  ? [Schema.toEncoded<Head>, ...TupleFieldsSchema<Tail>]
  : [];

type EncodedTupleFields<Fields extends ReadonlyArray<Schema.Top>> = Fields extends readonly [
  infer Head extends Schema.Top,
  ...infer Tail extends ReadonlyArray<Schema.Top>,
]
  ? [Schema.Codec.Encoded<Head>, ...EncodedTupleFields<Tail>]
  : [];

interface StructGetter<S extends object> extends Struct.Lambda {
  <Key extends keyof S>(key: Key): S[Key];
  readonly "~lambda.out": this["~lambda.in"] extends keyof S ? S[this["~lambda.in"]] : never;
}
const structGetter = <S extends object>(struct: S) =>
  Struct.lambda<StructGetter<S>>((key) => Struct.get(struct, key));

type TupleToStructSchema<
  Keys extends ReadonlyArray<string>,
  Fields extends ReadonlyTupleOf<Keys["length"], Schema.Top>,
> = Schema.Codec<Schema.Struct.Type<StructSchema<Keys, Fields>>, EncodedTupleFields<Fields>> & {
  readonly keys: Keys;
  readonly fields: Fields;
};

export const TupleToStructSchema = <
  Keys extends ReadonlyArray<string>,
  Fields extends ReadonlyTupleOf<Keys["length"], Schema.Top>,
>(
  keys: Keys,
  fields: Fields,
): TupleToStructSchema<Keys, Fields> => {
  const TupleSchema = Schema.Tuple(
    pipe(fields, Tuple.map(Schema.toEncoded)) as TupleFieldsSchema<Fields>,
  );
  const StructSchema = Schema.Struct(
    Object.fromEntries(Array.zip(keys, fields)) as StructSchema<Keys, Fields>,
  );

  const schema = TupleSchema.pipe(
    Schema.decodeTo(StructSchema, {
      decode: SchemaGetter.transform(
        (tuple) =>
          pipe(Array.zip(keys, tuple), Record.fromEntries) as unknown as Schema.Struct.Encoded<
            StructSchema<Keys, Fields>
          >,
      ),
      encode: SchemaGetter.transform(
        (struct) =>
          pipe(keys, Tuple.map(structGetter(struct))) as unknown as Schema.Tuple.Type<
            TupleFieldsSchema<Fields>
          >,
      ),
    }),
  ) as unknown as TupleToStructSchema<Keys, Fields>;

  return Object.assign(schema, { keys, fields });
};

type StructValueSchema<Keys extends ReadonlyArray<string>, Value extends Schema.Top> = {
  [K in Keys[number]]: Value;
};

type TupleValuesSchema<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Top,
> = ReadonlyTupleOf<Keys["length"], Schema.toEncoded<Value>>;

type EncodedTupleValues<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Top,
> = ReadonlyTupleOf<Keys["length"], Schema.Codec.Encoded<Value>>;

type TupleToStructValueSchema<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Top,
> = Schema.Codec<
  Schema.Struct.Type<StructValueSchema<Keys, Value>>,
  EncodedTupleValues<Keys, Value>
> & {
  readonly keys: Keys;
  readonly value: Value;
};

export const TupleToStructValueSchema = <
  const Keys extends ReadonlyArray<string>,
  Value extends Schema.Top,
>(
  keys: Keys,
  value: Value,
) => {
  const TupleSchema = Schema.Tuple(
    Array.makeBy(keys.length, () => Schema.toEncoded(value)) as TupleValuesSchema<Keys, Value>,
  );
  const StructSchema = Schema.Struct(
    Object.fromEntries(
      pipe(
        keys,
        Array.map((key) => [key, value]),
      ),
    ) as StructValueSchema<Keys, Value>,
  );

  const schema = TupleSchema.pipe(
    Schema.decodeTo(StructSchema, {
      decode: SchemaGetter.transform(
        (tuple) =>
          pipe(Array.zip(keys, tuple), Record.fromEntries) as unknown as Schema.Struct.Encoded<
            StructValueSchema<Keys, Value>
          >,
      ),
      encode: SchemaGetter.transform(
        (struct) =>
          pipe(keys, Tuple.map(structGetter(struct))) as unknown as Schema.Tuple.Type<
            TupleValuesSchema<Keys, Value>
          >,
      ),
    }),
  ) as unknown as TupleToStructValueSchema<Keys, Value>;

  return Object.assign(schema, { keys, value });
};
