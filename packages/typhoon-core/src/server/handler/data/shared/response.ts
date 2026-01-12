import { Data } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type BaseResponseConfig<T extends StandardSchemaV1 = StandardSchemaV1> = {
  validator: T;
};

const ResponseConfigTaggedClass: new <T extends StandardSchemaV1 = StandardSchemaV1>(
  args: Readonly<BaseResponseConfig<T>>,
) => Readonly<BaseResponseConfig<T>> & {
  readonly _tag: "ResponseConfig";
} = Data.TaggedClass("ResponseConfig");
export class ResponseConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
> extends ResponseConfigTaggedClass<T> {}

export type ResponseValidator<Config extends ResponseConfig> = Config["validator"];

export type ResponseConfigIn<T extends StandardSchemaV1 = StandardSchemaV1> = {
  validator: T;
};

export type ResponseConfigInValidator<Config extends ResponseConfigIn> = Config["validator"];

const configInValidator = <Config extends ResponseConfigIn>(config: Config) =>
  config.validator as ResponseConfigInValidator<Config>;

export type TransformedResponseConfig<Config extends ResponseConfigIn> = ResponseConfig<
  ResponseConfigInValidator<Config>
>;
export const transformResponseConfig = <const CParams extends ResponseConfigIn>(config: CParams) =>
  new ResponseConfig({
    validator: configInValidator(config),
  });
