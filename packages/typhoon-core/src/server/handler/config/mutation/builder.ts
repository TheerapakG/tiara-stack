import { Option, Struct } from "effect";
import { some } from "~/utils/strictOption";
import {
  PartialMutationHandlerConfig,
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

export type SetPartialMutationHandlerName<
  Name extends string,
  Config extends PartialMutationHandlerConfig,
> = PartialMutationHandlerConfig<
  Option.Some<Name>,
  RequestParamsOption<Config>,
  ResponseOption<Config>,
  ResponseErrorOption<Config>
>;
export const name: <const Name extends string>(
  name: Name,
) => <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => SetPartialMutationHandlerName<Name, Config> =
  <const Name extends string>(name: Name) =>
  <const Config extends PartialMutationHandlerConfig>(
    config: Config,
  ): SetPartialMutationHandlerName<Name, Config> =>
    new PartialMutationHandlerConfig({
      data: Struct.evolve(config.data, {
        name: () => some(name),
      }),
    }) as SetPartialMutationHandlerName<Name, Config>;

export type SetPartialMutationHandlerRequestParams<
  RequestParams extends RequestParamsConfigIn,
  Config extends PartialMutationHandlerConfig,
> = PartialMutationHandlerConfig<
  NameOption<Config>,
  Option.Some<TransformedRequestParamsConfig<RequestParams>>,
  ResponseOption<Config>,
  ResponseErrorOption<Config>
>;
export const requestParams: <const RequestParams extends RequestParamsConfigIn>(
  requestParams: RequestParams,
) => <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => SetPartialMutationHandlerRequestParams<RequestParams, Config> =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends PartialMutationHandlerConfig>(
    config: Config,
  ): SetPartialMutationHandlerRequestParams<RequestParams, Config> =>
    new PartialMutationHandlerConfig({
      data: Struct.evolve(config.data, {
        requestParams: () => some(transformRequestParamConfig(requestParams)),
      }),
    }) as SetPartialMutationHandlerRequestParams<RequestParams, Config>;

export type SetPartialMutationHandlerResponse<
  Response extends ResponseConfigIn,
  Config extends PartialMutationHandlerConfig,
> = PartialMutationHandlerConfig<
  NameOption<Config>,
  RequestParamsOption<Config>,
  Option.Some<TransformedResponseConfig<Response>>,
  ResponseErrorOption<Config>
>;
export const response: <const Response extends ResponseConfigIn>(
  response: Response,
) => <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => SetPartialMutationHandlerResponse<Response, Config> =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends PartialMutationHandlerConfig>(
    config: Config,
  ): SetPartialMutationHandlerResponse<Response, Config> =>
    new PartialMutationHandlerConfig({
      data: Struct.evolve(config.data, {
        response: () => some(transformResponseConfig(response)),
      }),
    }) as SetPartialMutationHandlerResponse<Response, Config>;

export type SetPartialMutationHandlerResponseError<
  ResponseError extends ResponseErrorConfigIn,
  Config extends PartialMutationHandlerConfig,
> = PartialMutationHandlerConfig<
  NameOption<Config>,
  RequestParamsOption<Config>,
  ResponseOption<Config>,
  Option.Some<TransformedResponseErrorConfig<ResponseError>>
>;
export const responseError: <const ResponseError extends ResponseErrorConfigIn>(
  responseError: ResponseError,
) => <const Config extends PartialMutationHandlerConfig>(
  config: Config,
) => SetPartialMutationHandlerResponseError<ResponseError, Config> =
  <const ResponseError extends ResponseErrorConfigIn>(
    responseError: ResponseError,
  ) =>
  <const Config extends PartialMutationHandlerConfig>(
    config: Config,
  ): SetPartialMutationHandlerResponseError<ResponseError, Config> =>
    new PartialMutationHandlerConfig({
      data: Struct.evolve(config.data, {
        responseError: () => some(transformResponseErrorConfig(responseError)),
      }),
    }) as SetPartialMutationHandlerResponseError<ResponseError, Config>;
