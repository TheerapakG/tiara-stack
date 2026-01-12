import { Match, pipe } from "effect";
import { type TypedPartialHandlerData, DummyHandlerData } from "./data";
import { type RequestParamsConfigIn } from "./shared/requestParams";
import { type ResponseConfigIn } from "./shared/response";
import { type ResponseErrorConfigIn } from "./shared/responseError";
import { empty as emptySubscription, PartialSubscriptionHandlerData } from "./subscription/data";
import {
  name as nameSubscription,
  type SetPartialSubscriptionHandlerName,
  requestParams as requestParamsSubscription,
  type SetPartialSubscriptionHandlerRequestParams,
  response as responseSubscription,
  type SetPartialSubscriptionHandlerResponse,
  responseError as responseErrorSubscription,
  type SetPartialSubscriptionHandlerResponseError,
} from "./subscription/builder";
import { empty as emptyMutation, PartialMutationHandlerData } from "./mutation/data";
import {
  name as nameMutation,
  type SetPartialMutationHandlerName,
  requestParams as requestParamsMutation,
  type SetPartialMutationHandlerRequestParams,
  response as responseMutation,
  type SetPartialMutationHandlerResponse,
  responseError as responseErrorMutation,
  type SetPartialMutationHandlerResponseError,
} from "./mutation/builder";

export type SetTypedPartialHandlerType<Type extends "subscription" | "mutation"> =
  Type extends "subscription"
    ? PartialSubscriptionHandlerData
    : Type extends "mutation"
      ? PartialMutationHandlerData
      : never;
export const type =
  <const Type extends "subscription" | "mutation">(type: Type) =>
  <const Config extends DummyHandlerData>(_: Config) =>
    pipe(
      Match.value(type as "subscription" | "mutation"),
      Match.whenAnd("subscription", emptySubscription),
      Match.whenAnd("mutation", emptyMutation),
      Match.exhaustive,
    ) as SetTypedPartialHandlerType<Type>;

export type SetTypedPartialHandlerName<
  Name extends string,
  Config extends TypedPartialHandlerData,
> = Config extends PartialSubscriptionHandlerData
  ? SetPartialSubscriptionHandlerName<Name, Config>
  : Config extends PartialMutationHandlerData
    ? SetPartialMutationHandlerName<Name, Config>
    : never;
export const name =
  <const Name extends string>(name: Name) =>
  <const Config extends TypedPartialHandlerData>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerData),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerData: (config) => nameSubscription(name)(config),
        PartialMutationHandlerData: (config) => nameMutation(name)(config),
      }),
    ) as SetTypedPartialHandlerName<Name, Config>;

export type SetTypedPartialHandlerRequestParams<
  RequestParams extends RequestParamsConfigIn,
  Config extends TypedPartialHandlerData,
> = Config extends PartialSubscriptionHandlerData
  ? SetPartialSubscriptionHandlerRequestParams<RequestParams, Config>
  : Config extends PartialMutationHandlerData
    ? SetPartialMutationHandlerRequestParams<RequestParams, Config>
    : never;
export const requestParams =
  <const RequestParams extends RequestParamsConfigIn>(requestParams: RequestParams) =>
  <const Config extends TypedPartialHandlerData>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerData),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerData: (config) =>
          requestParamsSubscription(requestParams)(config),
        PartialMutationHandlerData: (config) => requestParamsMutation(requestParams)(config),
      }),
    ) as SetTypedPartialHandlerRequestParams<RequestParams, Config>;

export type SetTypedPartialHandlerResponse<
  Response extends ResponseConfigIn,
  Config extends TypedPartialHandlerData,
> = Config extends PartialSubscriptionHandlerData
  ? SetPartialSubscriptionHandlerResponse<Response, Config>
  : Config extends PartialMutationHandlerData
    ? SetPartialMutationHandlerResponse<Response, Config>
    : never;
export const response =
  <const Response extends ResponseConfigIn>(response: Response) =>
  <const Config extends TypedPartialHandlerData>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerData),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerData: (config) => responseSubscription(response)(config),
        PartialMutationHandlerData: (config) => responseMutation(response)(config),
      }),
    ) as SetTypedPartialHandlerResponse<Response, Config>;

export type SetTypedPartialHandlerResponseError<
  ResponseError extends ResponseErrorConfigIn,
  Config extends TypedPartialHandlerData,
> = Config extends PartialSubscriptionHandlerData
  ? SetPartialSubscriptionHandlerResponseError<ResponseError, Config>
  : Config extends PartialMutationHandlerData
    ? SetPartialMutationHandlerResponseError<ResponseError, Config>
    : never;
export const responseError =
  <const ResponseError extends ResponseErrorConfigIn>(responseError: ResponseError) =>
  <const Config extends TypedPartialHandlerData>(config: Config) =>
    pipe(
      Match.value(config as TypedPartialHandlerData),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerData: (config) =>
          responseErrorSubscription(responseError)(config),
        PartialMutationHandlerData: (config) => responseErrorMutation(responseError)(config),
      }),
    ) as SetTypedPartialHandlerResponseError<ResponseError, Config>;
