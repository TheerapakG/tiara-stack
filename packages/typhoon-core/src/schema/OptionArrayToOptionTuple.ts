import { Array, Function, Option, pipe, Schema, Types } from "effect";

const TypeId: typeof Schema.TypeId = Schema.TypeId;
export { TypeId };

const OptionArrayToOptionTupleSchema$ = <
  const Count extends number,
  const Value extends Schema.Schema.Any,
>(
  count: Count,
  value: Value,
) => {
  const ArraySchema = Schema.Array(Schema.OptionFromSelf(value));
  const TupleSchema = Schema.Tuple(
    ...(Array.makeBy(count, () =>
      Schema.OptionFromSelf(value),
    ) as Types.TupleOf<Count, Schema.OptionFromSelf<Value>>),
  );

  return class OptionArrayToOptionTupleSchema extends Schema.transform(
    ArraySchema,
    TupleSchema,
    {
      strict: true,
      decode: (array) =>
        pipe(
          TupleSchema.elements,
          Array.map((_, index) =>
            pipe(Array.get(array, index), Option.flatten),
          ),
        ) as unknown as Schema.Schema.Encoded<typeof TupleSchema>,
      encode: Function.identity,
    },
  ) {
    static value = value;
  };
};

export { OptionArrayToOptionTupleSchema$ as OptionArrayToOptionTupleSchema };
