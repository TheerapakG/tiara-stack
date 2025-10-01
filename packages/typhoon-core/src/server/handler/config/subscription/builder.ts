import { Option, Struct } from "effect";
import { some } from "../../../../utils/strictOption";
import {
  PartialSubscriptionHandlerConfig,
  type NameOption,
  type RequestParamsOption,
  type ResponseOption,
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

export type SetPartialSubscriptionHandlerName<
  Name extends string,
  Config extends PartialSubscriptionHandlerConfig,
> = PartialSubscriptionHandlerConfig<
  Option.Some<Name>,
  RequestParamsOption<Config>,
  ResponseOption<Config>
>;
export const name =
  <const Name extends string>(name: Name) =>
  <const Config extends PartialSubscriptionHandlerConfig>(config: Config) =>
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
  ResponseOption<Config>
>;
export const requestParams =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends PartialSubscriptionHandlerConfig>(config: Config) =>
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
  Option.Some<TransformedResponseConfig<Response>>
>;
export const response =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends PartialSubscriptionHandlerConfig>(config: Config) =>
    new PartialSubscriptionHandlerConfig({
      data: Struct.evolve(config.data, {
        response: () => some(transformResponseConfig(response)),
      }),
    }) as SetPartialSubscriptionHandlerResponse<Response, Config>;
