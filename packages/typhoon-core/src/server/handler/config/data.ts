import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Option, pipe, Match } from "effect";
import {
  type GetOrUndefined,
  getOrUndefined,
  none,
  some,
} from "../../../utils/strictOption";
import { PartialSubscriptionHandlerConfig } from "./subscription/data";
import { PartialMutationHandlerConfig } from "./mutation/data";
import { RequestParamsConfig } from "./shared/requestParams";
import { ResponseConfig } from "./shared/response";

export class DummyHandlerConfig extends Data.TaggedClass(
  "DummyHandlerConfig",
) {}

export const empty = () => new DummyHandlerConfig();

export type TypedPartialHandlerConfig<
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> =
  | PartialSubscriptionHandlerConfig<Name, RequestParams, Response>
  | PartialMutationHandlerConfig<Name, RequestParams, Response>;

export type PartialHandlerConfig =
  | DummyHandlerConfig
  | TypedPartialHandlerConfig;

export type TypedHandlerConfig<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<
    StandardSchemaV1,
    boolean
  > = RequestParamsConfig<StandardSchemaV1, boolean>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> = TypedPartialHandlerConfig<
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response
>;

export type TypeOption<Config extends PartialHandlerConfig> =
  Config extends PartialSubscriptionHandlerConfig
    ? Option.Some<"subscription">
    : Config extends PartialMutationHandlerConfig
      ? Option.Some<"mutation">
      : Option.None<"subscription" | "mutation">;
export type TypeOrUndefined<Config extends PartialHandlerConfig> =
  GetOrUndefined<TypeOption<Config>>;

export const type = <const Config extends PartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    Match.value(config as PartialHandlerConfig),
    Match.tagsExhaustive({
      DummyHandlerConfig: () => none<"subscription" | "mutation">(),
      PartialSubscriptionHandlerConfig: () => some("subscription" as const),
      PartialMutationHandlerConfig: () => some("mutation" as const),
    }),
    getOrUndefined,
  ) as TypeOrUndefined<Config>;

export type NameOption<Config extends PartialHandlerConfig> =
  Config extends TypedPartialHandlerConfig
    ? Config["data"]["name"]
    : Option.None<string>;
export type NameOrUndefined<Config extends PartialHandlerConfig> =
  GetOrUndefined<NameOption<Config>>;

export const name = <const Config extends PartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    Match.value(config as PartialHandlerConfig),
    Match.tagsExhaustive({
      DummyHandlerConfig: () => none<string>(),
      PartialSubscriptionHandlerConfig: (config) => config.data.name,
      PartialMutationHandlerConfig: (config) => config.data.name,
    }),
    getOrUndefined,
  ) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends PartialHandlerConfig> =
  Config extends TypedPartialHandlerConfig
    ? Config["data"]["requestParams"]
    : Option.None<RequestParamsConfig<StandardSchemaV1, boolean>>;
export type RequestParamsOrUndefined<Config extends PartialHandlerConfig> =
  GetOrUndefined<RequestParamsOption<Config>>;

export const requestParams = <const Config extends PartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    Match.value(config as PartialHandlerConfig),
    Match.tagsExhaustive({
      DummyHandlerConfig: () =>
        none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
      PartialSubscriptionHandlerConfig: (config) => config.data.requestParams,
      PartialMutationHandlerConfig: (config) => config.data.requestParams,
    }),
    getOrUndefined,
  ) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends PartialHandlerConfig> =
  Config extends TypedPartialHandlerConfig
    ? Config["data"]["response"]
    : Option.None<ResponseConfig<StandardSchemaV1, boolean>>;
export type ResponseOrUndefined<Config extends PartialHandlerConfig> =
  GetOrUndefined<ResponseOption<Config>>;

export const response = <const Config extends PartialHandlerConfig>(
  config: Config,
) =>
  pipe(
    Match.value(config as PartialHandlerConfig),
    Match.tagsExhaustive({
      DummyHandlerConfig: () =>
        none<ResponseConfig<StandardSchemaV1, boolean>>(),
      PartialSubscriptionHandlerConfig: (config) => config.data.response,
      PartialMutationHandlerConfig: (config) => config.data.response,
    }),
    getOrUndefined,
  ) as ResponseOrUndefined<Config>;
