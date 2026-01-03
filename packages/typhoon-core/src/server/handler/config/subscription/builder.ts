import { Option, Struct } from "effect";
import { some } from "~/utils/strictOption";
import {
  PartialSubscriptionHandlerConfig,
  type NameOption,
  type RequestParamsOption,
  type ResponseOption,
  type ResponseErrorOption,
} from "./data";
import {
  type RequestParamsConfigIn,
  type TransformedRequestParamsConfig,
  transformRequestParamConfig,
} from "../shared/requestParams";
import {
  type ResponseConfigIn,
  type TransformedResponseConfig,
  transformResponseConfig,
} from "../shared/response";
import {
  type ResponseErrorConfigIn,
  type TransformedResponseErrorConfig,
  transformResponseErrorConfig,
} from "../shared/responseError";

export type SetPartialSubscriptionHandlerName<
  Name extends string,
  Config extends PartialSubscriptionHandlerConfig,
> = PartialSubscriptionHandlerConfig<
  Option.Some<Name>,
  RequestParamsOption<Config>,
  ResponseOption<Config>,
  ResponseErrorOption<Config>
>;
export const name: <const Name extends string>(
  name: Name,
) => <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => SetPartialSubscriptionHandlerName<Name, Config> =
  <const Name extends string>(name: Name) =>
  <const Config extends PartialSubscriptionHandlerConfig>(
    config: Config,
  ): SetPartialSubscriptionHandlerName<Name, Config> =>
    new PartialSubscriptionHandlerConfig({
      data: Struct.evolve(config.data, {
        name: () => some(name),
      }),
    }) as SetPartialSubscriptionHandlerName<Name, Config>;

export type SetPartialSubscriptionHandlerRequestParams<
  RequestParams extends RequestParamsConfigIn,
  Config extends PartialSubscriptionHandlerConfig,
> = PartialSubscriptionHandlerConfig<
  NameOption<Config>,
  Option.Some<TransformedRequestParamsConfig<RequestParams>>,
  ResponseOption<Config>,
  ResponseErrorOption<Config>
>;
export const requestParams: <const RequestParams extends RequestParamsConfigIn>(
  requestParams: RequestParams,
) => <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => SetPartialSubscriptionHandlerRequestParams<RequestParams, Config> =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends PartialSubscriptionHandlerConfig>(
    config: Config,
  ): SetPartialSubscriptionHandlerRequestParams<RequestParams, Config> =>
    new PartialSubscriptionHandlerConfig({
      data: Struct.evolve(config.data, {
        requestParams: () => some(transformRequestParamConfig(requestParams)),
      }),
    }) as SetPartialSubscriptionHandlerRequestParams<RequestParams, Config>;

export type SetPartialSubscriptionHandlerResponse<
  Response extends ResponseConfigIn,
  Config extends PartialSubscriptionHandlerConfig,
> = PartialSubscriptionHandlerConfig<
  NameOption<Config>,
  RequestParamsOption<Config>,
  Option.Some<TransformedResponseConfig<Response>>,
  ResponseErrorOption<Config>
>;
export const response: <const Response extends ResponseConfigIn>(
  response: Response,
) => <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => SetPartialSubscriptionHandlerResponse<Response, Config> =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends PartialSubscriptionHandlerConfig>(
    config: Config,
  ): SetPartialSubscriptionHandlerResponse<Response, Config> =>
    new PartialSubscriptionHandlerConfig({
      data: Struct.evolve(config.data, {
        response: () => some(transformResponseConfig(response)),
      }),
    }) as SetPartialSubscriptionHandlerResponse<Response, Config>;

export type SetPartialSubscriptionHandlerResponseError<
  ResponseError extends ResponseErrorConfigIn,
  Config extends PartialSubscriptionHandlerConfig,
> = PartialSubscriptionHandlerConfig<
  NameOption<Config>,
  RequestParamsOption<Config>,
  ResponseOption<Config>,
  Option.Some<TransformedResponseErrorConfig<ResponseError>>
>;
export const responseError: <const ResponseError extends ResponseErrorConfigIn>(
  responseError: ResponseError,
) => <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => SetPartialSubscriptionHandlerResponseError<ResponseError, Config> =
  <const ResponseError extends ResponseErrorConfigIn>(
    responseError: ResponseError,
  ) =>
  <const Config extends PartialSubscriptionHandlerConfig>(
    config: Config,
  ): SetPartialSubscriptionHandlerResponseError<ResponseError, Config> =>
    new PartialSubscriptionHandlerConfig({
      data: Struct.evolve(config.data, {
        responseError: () => some(transformResponseErrorConfig(responseError)),
      }),
    }) as SetPartialSubscriptionHandlerResponseError<ResponseError, Config>;
