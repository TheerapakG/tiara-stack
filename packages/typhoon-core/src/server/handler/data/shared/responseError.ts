import { Data } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type BaseResponseErrorConfig<T extends StandardSchemaV1 = StandardSchemaV1> = {
  validator: T;
};

const ResponseErrorConfigTaggedClass: new <T extends StandardSchemaV1 = StandardSchemaV1>(
  args: Readonly<BaseResponseErrorConfig<T>>,
) => Readonly<BaseResponseErrorConfig<T>> & {
  readonly _tag: "ResponseErrorConfig";
} = Data.TaggedClass("ResponseErrorConfig");
export class ResponseErrorConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
> extends ResponseErrorConfigTaggedClass<T> {}

export type ResponseErrorValidator<Config extends ResponseErrorConfig> = Config["validator"];

export type ResponseErrorConfigIn<T extends StandardSchemaV1 = StandardSchemaV1> = {
  validator: T;
};

export type ResponseErrorConfigInValidator<Config extends ResponseErrorConfigIn> =
  Config["validator"];

const configInValidator = <Config extends ResponseErrorConfigIn>(config: Config) =>
  config.validator as ResponseErrorConfigInValidator<Config>;

export type TransformedResponseErrorConfig<Config extends ResponseErrorConfigIn> =
  ResponseErrorConfig<ResponseErrorConfigInValidator<Config>>;
export const transformResponseErrorConfig = <const CParams extends ResponseErrorConfigIn>(
  config: CParams,
) =>
  new ResponseErrorConfig({
    validator: configInValidator(config),
  });
