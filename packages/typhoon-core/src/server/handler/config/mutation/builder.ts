import { Option, Struct } from "effect";
import { some } from "../../../../utils/strictOption";
import {
  PartialMutationHandlerConfig,
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

export type SetPartialMutationHandlerName<
  Name extends string,
  Config extends PartialMutationHandlerConfig,
> = PartialMutationHandlerConfig<
  Option.Some<Name>,
  RequestParamsOption<Config>,
  ResponseOption<Config>
>;
export const name =
  <const Name extends string>(name: Name) =>
  <const Config extends PartialMutationHandlerConfig>(config: Config) =>
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
  ResponseOption<Config>
>;
export const requestParams =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends PartialMutationHandlerConfig>(config: Config) =>
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
  Option.Some<TransformedResponseConfig<Response>>
>;
export const response =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends PartialMutationHandlerConfig>(config: Config) =>
    new PartialMutationHandlerConfig({
      data: Struct.evolve(config.data, {
        response: () => some(transformResponseConfig(response)),
      }),
    }) as SetPartialMutationHandlerResponse<Response, Config>;
