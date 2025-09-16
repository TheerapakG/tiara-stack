import { StandardSchemaV1 } from "@standard-schema/spec";
import { Option, Struct } from "effect";
import { StrictOption } from "../../utils";
import {
  HandlerConfig,
  NameOption,
  RequestParamsConfig,
  RequestParamsOption,
  ResponseConfig,
  ResponseOption,
  TypeOption,
} from "./data";

type CoercedTrue<T extends boolean | undefined> = T extends undefined
  ? true
  : T;
type CoercedFalse<T extends boolean | undefined> = T extends undefined
  ? false
  : T;

const coerceTrue = <T extends boolean | undefined>(
  value: T,
): CoercedTrue<T> => {
  return (value ?? true) as CoercedTrue<T>;
};

const coerceFalse = <T extends boolean | undefined>(
  value: T,
): CoercedFalse<T> => {
  return (value ?? false) as CoercedFalse<T>;
};

export const type =
  <const Type extends "subscription" | "mutation">(type: Type) =>
  <const Config extends HandlerConfig>(config: Config) =>
    new HandlerConfig({
      data: Struct.evolve(config.data, {
        type: () => StrictOption.some(type),
      }),
    }) as HandlerConfig<
      Option.Some<Type>,
      NameOption<Config>,
      RequestParamsOption<Config>,
      ResponseOption<Config>
    >;

export const name =
  <const Name extends string>(name: Name) =>
  <const Config extends HandlerConfig>(config: Config) =>
    new HandlerConfig({
      data: Struct.evolve(config.data, {
        name: () => StrictOption.some(name),
      }),
    }) as HandlerConfig<
      TypeOption<Config>,
      Option.Some<Name>,
      RequestParamsOption<Config>,
      ResponseOption<Config>
    >;

export type RequestParamsConfigIn<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean | undefined = boolean | undefined,
> = {
  validator: T;
  validate?: Validate;
};

const transformRequestParamConfig = <
  const CParams extends RequestParamsConfigIn,
>(
  config: CParams,
) =>
  new RequestParamsConfig({
    validator: config.validator as StandardSchemaV1<
      StandardSchemaV1.InferInput<CParams["validator"]>,
      StandardSchemaV1.InferOutput<CParams["validator"]>
    >,
    validate: coerceTrue(
      config.validate as "validate" extends keyof CParams
        ? CParams["validate"]
        : undefined,
    ),
  });

export const requestParams =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends HandlerConfig>(config: Config) => {
    const transformedRequestParams = transformRequestParamConfig(requestParams);
    return new HandlerConfig({
      data: Struct.evolve(config.data, {
        requestParams: () => StrictOption.some(transformedRequestParams),
      }),
    }) as HandlerConfig<
      TypeOption<Config>,
      NameOption<Config>,
      Option.Some<typeof transformedRequestParams>,
      ResponseOption<Config>
    >;
  };

export type ResponseConfigIn<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Stream extends boolean | undefined = boolean | undefined,
> = {
  validator: T;
  stream?: Stream;
};

const transformResponseConfig = <const CParams extends ResponseConfigIn>(
  config: CParams,
) =>
  new ResponseConfig({
    validator: config.validator as CParams["validator"],
    stream: coerceFalse(
      config.stream as "stream" extends keyof CParams
        ? CParams["stream"]
        : undefined,
    ),
  });

export const response =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends HandlerConfig>(config: Config) => {
    const transformedResponse = transformResponseConfig(response);
    return new HandlerConfig({
      data: Struct.evolve(config.data, {
        response: () => StrictOption.some(transformedResponse),
      }),
    }) as HandlerConfig<
      TypeOption<Config>,
      NameOption<Config>,
      RequestParamsOption<Config>,
      Option.Some<typeof transformedResponse>
    >;
  };
