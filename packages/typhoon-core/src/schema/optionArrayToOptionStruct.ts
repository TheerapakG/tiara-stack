import { Schema } from "effect";
import { OptionArrayToOptionTupleSchema } from "./optionArrayToOptionTuple";
import { TupleToStructValueSchema } from "./tupleToStruct";

type OptionArrayToOptionStructValueSchema<
  Keys extends ReadonlyArray<string>,
  Value extends Schema.Schema.Any,
> = Schema.transform<
  OptionArrayToOptionTupleSchema<
    Keys["length"],
    Schema.SchemaClass<Schema.Schema.Encoded<Value>>
  >,
  TupleToStructValueSchema<Keys, Schema.OptionFromSelf<Value>>
>;

const makeOptionArrayToOptionStructValueClass = <
  const Keys extends ReadonlyArray<string>,
  const Value extends Schema.Schema.Any,
>(
  keys: Keys,
  value: Value,
) => {
  const optionArrayToOptionTupleSchema = OptionArrayToOptionTupleSchema(
    keys.length as Keys["length"],
    Schema.encodedSchema(value),
  );
  const tupleToStructValueSchema = TupleToStructValueSchema(
    keys,
    Schema.OptionFromSelf(value),
  );

  return class extends Schema.compose(
    optionArrayToOptionTupleSchema,
    tupleToStructValueSchema,
    { strict: false },
  ) {
    static keys = keys;
    static value = value;
  } as unknown as OptionArrayToOptionStructValueSchema<Keys, Value>;
};

const OptionArrayToOptionStructValueSchema = <
  const Keys extends ReadonlyArray<string>,
  const Value extends Schema.Schema.Any,
>(
  keys: Keys,
  value: Value,
): OptionArrayToOptionStructValueSchema<Keys, Value> =>
  makeOptionArrayToOptionStructValueClass(keys, value);

export { OptionArrayToOptionStructValueSchema };
