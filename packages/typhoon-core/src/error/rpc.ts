import { Schema } from "effect";

type BaseRpcErrorFields = {
  readonly _tag: Schema.tag<"RpcError">;
  readonly message: typeof Schema.String;
};
type RpcErrorFields<CauseType, CauseEncoded, CauseContext> =
  BaseRpcErrorFields & {
    readonly cause: Schema.Schema<CauseType, CauseEncoded, CauseContext>;
  } extends infer B
    ? B
    : never;

interface RpcErrorClass<CauseType, CauseEncoded, CauseContext>
  extends Schema.TaggedErrorClass<
    RpcError<CauseType>,
    "RpcError",
    RpcErrorFields<CauseType, CauseEncoded, CauseContext>
  > {}

export interface RpcError<Cause>
  extends Schema.Struct.Type<BaseRpcErrorFields> {
  readonly cause: Cause;
}

const RpcErrorClass = <CauseType, CauseEncoded, CauseContext>(
  causeSchema: Schema.Schema<CauseType, CauseEncoded, CauseContext>,
) => {
  return class extends Schema.TaggedError<RpcError<CauseType>>()("RpcError", {
    message: Schema.String,
    cause: causeSchema as Schema.Schema.Any,
  }) {} as RpcErrorClass<CauseType, CauseEncoded, CauseContext>;
};

export const makeRpcError: <CauseType, CauseEncoded, CauseContext>(
  causeSchema: Schema.Schema<CauseType, CauseEncoded, CauseContext>,
) => (message: string, cause: CauseType) => RpcError<CauseType> =
  <CauseType, CauseEncoded, CauseContext>(
    causeSchema: Schema.Schema<CauseType, CauseEncoded, CauseContext>,
  ) =>
  (message: string, cause: CauseType) => {
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
