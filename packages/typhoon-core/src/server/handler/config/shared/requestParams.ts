import { Data } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { coerceTrue, type CoercedTrue } from "../../../../utils/coerce";

export type BaseRequestParamsConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean = boolean,
> = {
  validator: T;
  validate: Validate;
};

const RequestParamsConfigTaggedClass: new <
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean = boolean,
>(
  args: Readonly<BaseRequestParamsConfig<T, Validate>>,
) => Readonly<BaseRequestParamsConfig<T, Validate>> & {
  readonly _tag: "RequestParamsConfig";
} = Data.TaggedClass("RequestParamsConfig");
export class RequestParamsConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Validate extends boolean = boolean,
> extends RequestParamsConfigTaggedClass<T, Validate> {}

export type RequestParamsValidator<Config extends RequestParamsConfig> =
  Config["validator"];
export type RequestParamsValidate<Config extends RequestParamsConfig> =
  Config["validate"];

export type RequestParamsConfigIn<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean | undefined = boolean | undefined,
> = {
  validator: T;
  validate?: Validate;
};

export type RequestParamsConfigInValidator<
  Config extends RequestParamsConfigIn,
> = StandardSchemaV1<
  StandardSchemaV1.InferInput<Config["validator"]>,
  StandardSchemaV1.InferOutput<Config["validator"]>
>;
export type RequestParamsConfigInValidate<
  Config extends RequestParamsConfigIn,
> = "validate" extends keyof Config ? Config["validate"] : undefined;

const configInValidator = <Config extends RequestParamsConfigIn>(
  config: Config,
) => config.validator as RequestParamsConfigInValidator<Config>;
const configInValidate = <Config extends RequestParamsConfigIn>(
  config: Config,
) => config.validate as RequestParamsConfigInValidate<Config>;

export type TransformedRequestParamsConfig<
  Config extends RequestParamsConfigIn,
> = RequestParamsConfig<
  RequestParamsConfigInValidator<Config>,
  CoercedTrue<RequestParamsConfigInValidate<Config>>
>;
export const transformRequestParamConfig = <
  const CParams extends RequestParamsConfigIn,
>(
  config: CParams,
) =>
  new RequestParamsConfig({
    validator: configInValidator(config),
    validate: coerceTrue(configInValidate(config)),
  });
