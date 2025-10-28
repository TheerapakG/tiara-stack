import { Data, Option } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { RequestParamsConfig } from "../shared/requestParams";
import { ResponseConfig } from "../shared/response";
import { ResponseErrorConfig } from "../shared/responseError";
import {
  type BasePartialHandlerConfig,
  type NameOption as BaseNameOption,
  type NameOrUndefined as BaseNameOrUndefined,
  type RequestParamsOption as BaseRequestParamsOption,
  type RequestParamsOrUndefined as BaseRequestParamsOrUndefined,
  type ResponseOption as BaseResponseOption,
  type ResponseOrUndefined as BaseResponseOrUndefined,
  type ResponseErrorOption as BaseResponseErrorOption,
  type ResponseErrorOrUndefined as BaseResponseErrorOrUndefined,
  name as baseName,
  requestParams as baseRequestParams,
  response as baseResponse,
  responseError as baseResponseError,
} from "../shared/data";
import { none } from "~/utils/strictOption";

type PartialMutationHandlerConfigData<
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
  ResponseError extends Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  > = Option.Option<ResponseErrorConfig<StandardSchemaV1>>,
> = {
  data: BasePartialHandlerConfig<Name, RequestParams, Response, ResponseError>;
};
const PartialMutationHandlerConfigTaggedClass: new <
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
  ResponseError extends Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  > = Option.Option<ResponseErrorConfig<StandardSchemaV1>>,
>(
  args: Readonly<
    PartialMutationHandlerConfigData<
      Name,
      RequestParams,
      Response,
      ResponseError
    >
  >,
) => Readonly<
  PartialMutationHandlerConfigData<Name, RequestParams, Response, ResponseError>
> & {
  readonly _tag: "PartialMutationHandlerConfig";
} = Data.TaggedClass("PartialMutationHandlerConfig");
export class PartialMutationHandlerConfig<
  const Name extends Option.Option<string> = Option.Option<string>,
  const RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  const Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
  ResponseError extends Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  > = Option.Option<ResponseErrorConfig<StandardSchemaV1>>,
> extends PartialMutationHandlerConfigTaggedClass<
  Name,
  RequestParams,
  Response,
  ResponseError
> {}

export const empty = () =>
  new PartialMutationHandlerConfig({
    data: {
      name: none<string>(),
      requestParams: none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
      response: none<ResponseConfig<StandardSchemaV1>>(),
      responseError: none<ResponseErrorConfig<StandardSchemaV1>>(),
    },
  });

export type MutationHandlerConfig<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<
    StandardSchemaV1,
    boolean
  > = RequestParamsConfig<StandardSchemaV1, boolean>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
  ResponseError extends Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  > = Option.Option<ResponseErrorConfig<StandardSchemaV1>>,
> = PartialMutationHandlerConfig<
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response,
  ResponseError
>;

export type NameOption<Config extends PartialMutationHandlerConfig> =
  BaseNameOption<Config["data"]>;
export type NameOrUndefined<Config extends PartialMutationHandlerConfig> =
  BaseNameOrUndefined<Config["data"]>;

export const name = <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => baseName(config.data) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends PartialMutationHandlerConfig> =
  BaseRequestParamsOption<Config["data"]>;
export type RequestParamsOrUndefined<
  Config extends PartialMutationHandlerConfig,
> = BaseRequestParamsOrUndefined<Config["data"]>;

export const requestParams = <
  const Config extends PartialMutationHandlerConfig,
>(
  config: Config,
) => baseRequestParams(config.data) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends PartialMutationHandlerConfig> =
  BaseResponseOption<Config["data"]>;
export type ResponseOrUndefined<Config extends PartialMutationHandlerConfig> =
  BaseResponseOrUndefined<Config["data"]>;

export const response = <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => baseResponse(config.data) as ResponseOrUndefined<Config>;

export type ResponseErrorOption<Config extends PartialMutationHandlerConfig> =
  BaseResponseErrorOption<Config["data"]>;
export type ResponseErrorOrUndefined<
  Config extends PartialMutationHandlerConfig,
> = BaseResponseErrorOrUndefined<Config["data"]>;

export const responseError = <
  const Config extends PartialMutationHandlerConfig,
>(
  config: Config,
) => baseResponseError(config.data) as ResponseErrorOrUndefined<Config>;
