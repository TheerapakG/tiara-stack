import { Option, pipe } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { RequestParamsConfig } from "./requestParams";
import { ResponseConfig } from "./response";
import { ResponseErrorConfig } from "./responseError";
import { type GetOrUndefined, getOrUndefined } from "~/utils/strictOption";

export type BasePartialHandlerConfig<
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
  name: Name;
  requestParams: RequestParams;
  response: Response;
  responseError: ResponseError;
};

export type BaseHandlerConfig<
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
> = {
  data: BasePartialHandlerConfig<
    Option.Some<Name>,
    Option.Some<RequestParams>,
    Response,
    ResponseError
  >;
};

export type NameOption<Config extends BasePartialHandlerConfig> =
  Config["name"];
export type NameOrUndefined<Config extends BasePartialHandlerConfig> =
  GetOrUndefined<NameOption<Config>>;

export const name = <const Config extends BasePartialHandlerConfig>(
  config: Config,
) => pipe(config.name, getOrUndefined) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends BasePartialHandlerConfig> =
  Config["requestParams"];
export type RequestParamsOrUndefined<Config extends BasePartialHandlerConfig> =
  GetOrUndefined<RequestParamsOption<Config>>;

export const requestParams = <const Config extends BasePartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    config.requestParams,
    getOrUndefined,
  ) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends BasePartialHandlerConfig> =
  Config["response"];
export type ResponseOrUndefined<Config extends BasePartialHandlerConfig> =
  GetOrUndefined<ResponseOption<Config>>;

export const response = <const Config extends BasePartialHandlerConfig>(
  config: Config,
) => pipe(config.response, getOrUndefined) as ResponseOrUndefined<Config>;

export type ResponseErrorOption<Config extends BasePartialHandlerConfig> =
  Config["responseError"];
export type ResponseErrorOrUndefined<Config extends BasePartialHandlerConfig> =
  GetOrUndefined<ResponseErrorOption<Config>>;

export const responseError = <const Config extends BasePartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    config.responseError,
    getOrUndefined,
  ) as ResponseErrorOrUndefined<Config>;
