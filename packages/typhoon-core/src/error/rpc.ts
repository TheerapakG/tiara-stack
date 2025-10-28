import { Schema } from "effect";

type RpcErrorFields<Cause> = {
  readonly _tag: Schema.tag<"RpcError">;
  readonly message: typeof Schema.String;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly cause: Schema.optionalWith<
    Schema.Schema<Cause, any, any>,
    { nullable: true }
  >;
};

interface RpcErrorClass<Cause>
  extends Schema.TaggedErrorClass<
    RpcError<Cause>,
    "RpcError",
    RpcErrorFields<Cause>
  > {}

export interface RpcError<Cause>
  extends Schema.Struct.Type<RpcErrorFields<Cause>> {}

const RpcErrorClass = <CauseSchema extends Schema.Schema.Any>(
  causeSchema: CauseSchema,
) => {
  return class extends Schema.TaggedError<
    RpcError<Schema.Schema.Type<CauseSchema>>
  >()("RpcError", {
    message: Schema.String,
    cause: Schema.optionalWith(causeSchema, { nullable: true }),
  }) {} as RpcErrorClass<Schema.Schema.Type<CauseSchema>>;
};

export const makeRpcError: <CauseSchema extends Schema.Schema.Any>(
  causeSchema: CauseSchema,
) => (
  message: string,
  cause?: Schema.Schema.Type<CauseSchema>,
) => RpcError<Schema.Schema.Type<CauseSchema>> &
  Schema.Struct.Type<RpcErrorFields<Schema.Schema.Type<CauseSchema>>> =
  <CauseSchema extends Schema.Schema.Any>(causeSchema: CauseSchema) =>
  (message: string, cause?: Schema.Schema.Type<CauseSchema>) => {
    const constructor = RpcErrorClass(causeSchema);
    return new constructor({ message, cause });
  };

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

export const makeMissingRpcConfigError = (message: string, cause?: unknown) =>
  new MissingRpcConfigError({ message, cause });
