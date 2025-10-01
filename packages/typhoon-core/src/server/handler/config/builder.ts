import { Match, pipe } from "effect";
import { type TypedPartialHandlerConfig, DummyHandlerConfig } from "./data";
import { type RequestParamsConfigIn } from "./shared/requestParams";
import { type ResponseConfigIn } from "./shared/response";
import {
  empty as emptySubscription,
  PartialSubscriptionHandlerConfig,
} from "./subscription/data";
import {
  name as nameSubscription,
  type SetPartialSubscriptionHandlerName,
  requestParams as requestParamsSubscription,
  type SetPartialSubscriptionHandlerRequestParams,
  response as responseSubscription,
  type SetPartialSubscriptionHandlerResponse,
} from "./subscription/builder";
import {
  empty as emptyMutation,
  PartialMutationHandlerConfig,
} from "./mutation/data";
import {
  name as nameMutation,
  type SetPartialMutationHandlerName,
  requestParams as requestParamsMutation,
  type SetPartialMutationHandlerRequestParams,
  response as responseMutation,
  type SetPartialMutationHandlerResponse,
} from "./mutation/builder";

export type SetTypedPartialHandlerType<
  Type extends "subscription" | "mutation",
> = Type extends "subscription"
  ? PartialSubscriptionHandlerConfig
  : Type extends "mutation"
    ? PartialMutationHandlerConfig
    : never;
export const type =
  <const Type extends "subscription" | "mutation">(type: Type) =>
  <const Config extends DummyHandlerConfig>(_: Config) =>
    pipe(
      Match.value(type as "subscription" | "mutation"),
      Match.whenAnd("subscription", emptySubscription),
      Match.whenAnd("mutation", emptyMutation),
      Match.exhaustive,
    ) as SetTypedPartialHandlerType<Type>;

export type SetTypedPartialHandlerName<
  Name extends string,
  Config extends TypedPartialHandlerConfig,
> = Config extends PartialSubscriptionHandlerConfig
  ? SetPartialSubscriptionHandlerName<Name, Config>
  : Config extends PartialMutationHandlerConfig
    ? SetPartialMutationHandlerName<Name, Config>
    : never;
export const name =
  <const Name extends string>(name: Name) =>
  <const Config extends TypedPartialHandlerConfig>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerConfig),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerConfig: (config) =>
          nameSubscription(name)(config),
        PartialMutationHandlerConfig: (config) => nameMutation(name)(config),
      }),
    ) as SetTypedPartialHandlerName<Name, Config>;

export type SetTypedPartialHandlerRequestParams<
  RequestParams extends RequestParamsConfigIn,
  Config extends TypedPartialHandlerConfig,
> = Config extends PartialSubscriptionHandlerConfig
  ? SetPartialSubscriptionHandlerRequestParams<RequestParams, Config>
  : Config extends PartialMutationHandlerConfig
    ? SetPartialMutationHandlerRequestParams<RequestParams, Config>
    : never;
export const requestParams =
  <const RequestParams extends RequestParamsConfigIn>(
    requestParams: RequestParams,
  ) =>
  <const Config extends TypedPartialHandlerConfig>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerConfig),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerConfig: (config) =>
          requestParamsSubscription(requestParams)(config),
        PartialMutationHandlerConfig: (config) =>
          requestParamsMutation(requestParams)(config),
      }),
    ) as SetTypedPartialHandlerRequestParams<RequestParams, Config>;

export type SetTypedPartialHandlerResponse<
  Response extends ResponseConfigIn,
  Config extends TypedPartialHandlerConfig,
> = Config extends PartialSubscriptionHandlerConfig
  ? SetPartialSubscriptionHandlerResponse<Response, Config>
  : Config extends PartialMutationHandlerConfig
    ? SetPartialMutationHandlerResponse<Response, Config>
    : never;
export const response =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends TypedPartialHandlerConfig>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerConfig),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerConfig: (config) =>
          responseSubscription(response)(config),
        PartialMutationHandlerConfig: (config) =>
          responseMutation(response)(config),
      }),
    ) as SetTypedPartialHandlerResponse<Response, Config>;
