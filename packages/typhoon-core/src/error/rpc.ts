import { Schema, Data, ParseResult, pipe, Effect } from "effect";

type RpcErrorData<CauseType> = {
  readonly message: string;
  readonly cause: CauseType;
};
const RpcErrorTaggedError = Data.TaggedError("RpcError") as new <CauseType>(
  args: Readonly<RpcErrorData<CauseType>>,
) => Readonly<RpcErrorData<CauseType>> & {
  readonly _tag: "RpcError";
};

type RpcErrorStructSchema<CauseType, CauseEncoded, CauseContext> =
  Schema.TaggedStruct<
    "RpcError",
    {
      readonly message: typeof Schema.String;
      readonly cause: Schema.Schema<CauseType, CauseEncoded, CauseContext>;
    }
  >;
interface RpcErrorSchema<CauseType, CauseEncoded, CauseContext>
  extends Schema.declare<
    Schema.Schema.Type<
      RpcErrorStructSchema<CauseType, CauseEncoded, CauseContext>
    >,
    Schema.Schema.Encoded<
      RpcErrorStructSchema<CauseType, CauseEncoded, CauseContext>
    >,
    [RpcErrorStructSchema<CauseType, CauseEncoded, CauseContext>]
  > {
  readonly _tag: "RpcError";
  readonly fields: RpcErrorStructSchema<
    CauseType,
    CauseEncoded,
    CauseContext
  >["fields"];
}

export class RpcError<CauseType> extends RpcErrorTaggedError<CauseType> {
  static schema = <CauseType, CauseEncoded = CauseType, CauseContext = never>(
    schema: Schema.Schema<CauseType, CauseEncoded, CauseContext>,
  ) => {
    const structSchema = Schema.TaggedStruct("RpcError", {
      message: Schema.String,
      cause: schema,
    });

    return class extends Schema.declare([structSchema], {
      decode: (structSchema) => (struct, options) => {
        return pipe(
          struct,
          ParseResult.decodeUnknown(structSchema, options),
          Effect.map((struct) => new RpcError(struct)),
        );
      },
      encode: (structSchema) => (error, options) => {
        return pipe(error, ParseResult.encodeUnknown(structSchema, options));
      },
    }) {
      static readonly _tag = "RpcError";
      static readonly fields = structSchema.fields;
    } as RpcErrorSchema<CauseType, CauseEncoded, CauseContext>;
  };
}

const MissingRpcConfigErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const MissingRpcConfigTaggedError: Schema.TaggedErrorClass<
  MissingRpcConfigError,
  "MissingRpcConfigError",
  {
    readonly _tag: Schema.tag<"MissingRpcConfigError">;
  } & (typeof MissingRpcConfigErrorData)["fields"]
> = Schema.TaggedError<MissingRpcConfigError>()(
  "MissingRpcConfigError",
  MissingRpcConfigErrorData,
);
export class MissingRpcConfigError extends MissingRpcConfigTaggedError {}
