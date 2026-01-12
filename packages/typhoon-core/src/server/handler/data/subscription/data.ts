import { Data, Option } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { RequestParamsConfig } from "../shared/requestParams";
import { ResponseConfig } from "../shared/response";
import { ResponseErrorConfig } from "../shared/responseError";
import {
  type BasePartialHandlerData,
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

type PartialSubscriptionHandlerDataData<
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>> =
    Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
  ResponseError extends Option.Option<ResponseErrorConfig<StandardSchemaV1>> = Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  >,
> = {
  data: BasePartialHandlerData<Name, RequestParams, Response, ResponseError>;
};
const PartialSubscriptionHandlerDataTaggedClass: new <
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>> =
    Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
  ResponseError extends Option.Option<ResponseErrorConfig<StandardSchemaV1>> = Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  >,
>(
  args: Readonly<PartialSubscriptionHandlerDataData<Name, RequestParams, Response, ResponseError>>,
) => Readonly<PartialSubscriptionHandlerDataData<Name, RequestParams, Response, ResponseError>> & {
  readonly _tag: "PartialSubscriptionHandlerData";
} = Data.TaggedClass("PartialSubscriptionHandlerData");
export class PartialSubscriptionHandlerData<
  const Name extends Option.Option<string> = Option.Option<string>,
  const RequestParams extends Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>> =
    Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  const Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
  ResponseError extends Option.Option<ResponseErrorConfig<StandardSchemaV1>> = Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  >,
> extends PartialSubscriptionHandlerDataTaggedClass<Name, RequestParams, Response, ResponseError> {}

export const empty = () =>
  new PartialSubscriptionHandlerData({
    data: {
      name: none<string>(),
      requestParams: none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
      response: none<ResponseConfig<StandardSchemaV1>>(),
      responseError: none<ResponseErrorConfig<StandardSchemaV1>>(),
    },
  });

export type SubscriptionHandlerData<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<StandardSchemaV1, boolean> = RequestParamsConfig<
    StandardSchemaV1,
    boolean
  >,
  Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
  ResponseError extends Option.Option<ResponseErrorConfig<StandardSchemaV1>> = Option.Option<
    ResponseErrorConfig<StandardSchemaV1>
  >,
> = PartialSubscriptionHandlerData<
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response,
  ResponseError
>;

export type NameOption<Config extends PartialSubscriptionHandlerData> = BaseNameOption<
  Config["data"]
>;
export type NameOrUndefined<Config extends PartialSubscriptionHandlerData> = BaseNameOrUndefined<
  Config["data"]
>;

export const name = <const Config extends PartialSubscriptionHandlerData>(config: Config) =>
  baseName(config.data) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends PartialSubscriptionHandlerData> =
  BaseRequestParamsOption<Config["data"]>;
export type RequestParamsOrUndefined<Config extends PartialSubscriptionHandlerData> =
  BaseRequestParamsOrUndefined<Config["data"]>;

export const requestParams = <const Config extends PartialSubscriptionHandlerData>(
  config: Config,
) => baseRequestParams(config.data) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends PartialSubscriptionHandlerData> = BaseResponseOption<
  Config["data"]
>;
export type ResponseOrUndefined<Config extends PartialSubscriptionHandlerData> =
  BaseResponseOrUndefined<Config["data"]>;

export const response = <const Config extends PartialSubscriptionHandlerData>(config: Config) =>
  baseResponse(config.data) as ResponseOrUndefined<Config>;

export type ResponseErrorOption<Config extends PartialSubscriptionHandlerData> =
  BaseResponseErrorOption<Config["data"]>;
export type ResponseErrorOrUndefined<Config extends PartialSubscriptionHandlerData> =
  BaseResponseErrorOrUndefined<Config["data"]>;

export const responseError = <const Config extends PartialSubscriptionHandlerData>(
  config: Config,
) => baseResponseError(config.data) as ResponseErrorOrUndefined<Config>;
