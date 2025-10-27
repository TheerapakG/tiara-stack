import { Cause, Data } from "effect";

type RpcErrorData = {
  message: string;
  cause?: unknown;
};
const RpcErrorTaggedError: new (
  args: Readonly<RpcErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "RpcError";
} & Readonly<RpcErrorData> = Data.TaggedError("RpcError")<RpcErrorData>;
export class RpcError extends RpcErrorTaggedError {}

export const makeRpcError = (message: string, cause?: unknown) =>
  new RpcError({ message, cause });

type MissingRpcConfigErrorData = {
  message: string;
  cause?: unknown;
};
const MissingRpcConfigTaggedError: new (
  args: Readonly<MissingRpcConfigErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "MissingRpcConfigError";
} & Readonly<MissingRpcConfigErrorData> = Data.TaggedError(
  "MissingRpcConfigError",
)<MissingRpcConfigErrorData>;
export class MissingRpcConfigError extends MissingRpcConfigTaggedError {}

export const makeMissingRpcConfigError = (message: string, cause?: unknown) =>
  new MissingRpcConfigError({ message, cause });
