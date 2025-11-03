import { Array, Function, Option, pipe, Schema, Types } from "effect";

const OptionArrayToOptionTupleTypeId: typeof Schema.TypeId = Schema.TypeId;
export { OptionArrayToOptionTupleTypeId };

type OptionArrayToOptionTupleSchema<
  Count extends number,
  Value extends Schema.Schema.Any,
> = Schema.transform<
  Schema.Array$<
    Schema.OptionFromSelf<Schema.SchemaClass<Schema.Schema.Encoded<Value>>>
  >,
  Schema.Tuple<Types.TupleOf<Count, Schema.OptionFromSelf<Value>>>
> & {
  readonly count: Count;
  readonly value: Value;
};

const makeOptionArrayToOptionTupleClass = <
  const Count extends number,
  const Value extends Schema.Schema.Any,
>(
  count: Count,
  value: Value,
) => {
  const ArraySchema = Schema.Array(
    Schema.OptionFromSelf(Schema.encodedSchema(value)),
  );
  const TupleSchema = Schema.Tuple(
    ...(Array.makeBy(count, () =>
      Schema.OptionFromSelf(value),
    ) as Types.TupleOf<Count, Schema.OptionFromSelf<Value>>),
  );

  return class extends Schema.transform(ArraySchema, TupleSchema, {
    strict: true,
    decode: (array) =>
      pipe(
        TupleSchema.elements,
        Array.map((_, index) => pipe(Array.get(array, index), Option.flatten)),
      ) as unknown as Schema.Schema.Encoded<typeof TupleSchema>,
    encode: Function.identity,
  }) {
    static count = count;
    static value = value;
  } as unknown as OptionArrayToOptionTupleSchema<Count, Value>;
};

const OptionArrayToOptionTupleSchema = <
  const Count extends number,
  const Value extends Schema.Schema.Any,
>(
  count: Count,
  value: Value,
): OptionArrayToOptionTupleSchema<Count, Value> =>
  makeOptionArrayToOptionTupleClass(count, value);

export { OptionArrayToOptionTupleSchema };
