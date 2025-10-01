import { Data } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { coerceFalse, type CoercedFalse } from "../../../../utils/coerce";

export type BaseResponseConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Stream extends boolean = boolean,
> = {
  validator: T;
  stream: Stream;
};

export class ResponseConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Stream extends boolean = boolean,
> extends Data.TaggedClass("ResponseConfig")<BaseResponseConfig<T, Stream>> {}

export type ResponseValidator<Config extends ResponseConfig> =
  Config["validator"];
export type ResponseStream<Config extends ResponseConfig> = Config["stream"];

export type ResponseConfigIn<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Stream extends boolean | undefined = boolean | undefined,
> = {
  validator: T;
  stream?: Stream;
};

export type ResponseConfigInValidator<Config extends ResponseConfigIn> =
  StandardSchemaV1<
    StandardSchemaV1.InferInput<Config["validator"]>,
    StandardSchemaV1.InferOutput<Config["validator"]>
  >;
export type ResponseConfigInStream<Config extends ResponseConfigIn> =
  "stream" extends keyof Config ? Config["stream"] : undefined;

const configInValidator = <Config extends ResponseConfigIn>(config: Config) =>
  config.validator as ResponseConfigInValidator<Config>;
const configInStream = <Config extends ResponseConfigIn>(config: Config) =>
  config.stream as ResponseConfigInStream<Config>;

export type TransformedResponseConfig<Config extends ResponseConfigIn> =
  ResponseConfig<
    ResponseConfigInValidator<Config>,
    CoercedFalse<ResponseConfigInStream<Config>>
  >;
export const transformResponseConfig = <const CParams extends ResponseConfigIn>(
  config: CParams,
) =>
  new ResponseConfig({
    validator: configInValidator(config),
    stream: coerceFalse(configInStream(config)),
  });
