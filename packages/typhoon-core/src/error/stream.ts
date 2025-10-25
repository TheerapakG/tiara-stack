import { Cause, Data } from "effect";

type StreamExhaustedErrorData = {
  message: string;
  cause?: unknown;
};
const StreamExhaustedErrorTaggedError: new (
  args: Readonly<StreamExhaustedErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "StreamExhaustedError";
} & Readonly<StreamExhaustedErrorData> = Data.TaggedError(
  "StreamExhaustedError",
)<StreamExhaustedErrorData>;
export class StreamExhaustedError extends StreamExhaustedErrorTaggedError {}

export const makeStreamExhaustedError = (message: string, cause?: unknown) =>
  new StreamExhaustedError({ message, cause });
