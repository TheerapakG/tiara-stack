import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Option, pipe, Match } from "effect";
import { type GetOrUndefined, getOrUndefined, none, some } from "~/utils/strictOption";
import { PartialSubscriptionHandlerData } from "./subscription/data";
import { PartialMutationHandlerData } from "./mutation/data";
import { RequestParamsConfig } from "./shared/requestParams";
import { ResponseConfig } from "./shared/response";
import { ResponseErrorConfig } from "./shared/responseError";

const DummyHandlerDataTaggedClass: new (args: void) => {
  readonly _tag: "DummyHandlerData";
} = Data.TaggedClass("DummyHandlerData");
export class DummyHandlerData extends DummyHandlerDataTaggedClass {}

export const empty = () => new DummyHandlerData();

export type TypedPartialHandlerData<
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>> =
    Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
> =
  | PartialSubscriptionHandlerData<Name, RequestParams, Response>
  | PartialMutationHandlerData<Name, RequestParams, Response>;

export type PartialHandlerData = DummyHandlerData | TypedPartialHandlerData;

export type TypedHandlerData<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<StandardSchemaV1, boolean> = RequestParamsConfig<
    StandardSchemaV1,
    boolean
  >,
  Response extends Option.Option<ResponseConfig<StandardSchemaV1>> = Option.Option<
    ResponseConfig<StandardSchemaV1>
  >,
> = TypedPartialHandlerData<Option.Some<Name>, Option.Some<RequestParams>, Response>;

export type TypeOption<Config extends PartialHandlerData> =
  Config extends PartialSubscriptionHandlerData
    ? Option.Some<"subscription">
    : Config extends PartialMutationHandlerData
      ? Option.Some<"mutation">
      : Option.None<"subscription" | "mutation">;
export type TypeOrUndefined<Config extends PartialHandlerData> = GetOrUndefined<TypeOption<Config>>;

export const type = <const Config extends PartialHandlerData>(config: Config) =>
  pipe(
    Match.value(config as PartialHandlerData),
    Match.tagsExhaustive({
      DummyHandlerData: () => none<"subscription" | "mutation">(),
      PartialSubscriptionHandlerData: () => some("subscription" as const),
      PartialMutationHandlerData: () => some("mutation" as const),
    }),
    getOrUndefined,
  ) as TypeOrUndefined<Config>;

export type NameOption<Config extends PartialHandlerData> = Config extends TypedPartialHandlerData
  ? Config["data"]["name"]
  : Option.None<string>;
export type NameOrUndefined<Config extends PartialHandlerData> = GetOrUndefined<NameOption<Config>>;

export const name = <const Config extends PartialHandlerData>(config: Config) =>
  pipe(
    Match.value(config as PartialHandlerData),
    Match.tagsExhaustive({
      DummyHandlerData: () => none<string>(),
      PartialSubscriptionHandlerData: (config) => config.data.name,
      PartialMutationHandlerData: (config) => config.data.name,
    }),
    getOrUndefined,
  ) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends PartialHandlerData> =
  Config extends TypedPartialHandlerData
    ? Config["data"]["requestParams"]
    : Option.None<RequestParamsConfig<StandardSchemaV1, boolean>>;
export type RequestParamsOrUndefined<Config extends PartialHandlerData> =
  GetOrUndefined<RequestParamsOption<Config>> extends infer RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined
    ? RequestParams
    : never;

export const requestParams = <const Config extends PartialHandlerData>(config: Config) =>
  pipe(
    Match.value(config as PartialHandlerData),
    Match.tagsExhaustive({
      DummyHandlerData: () => none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
      PartialSubscriptionHandlerData: (config) => config.data.requestParams,
      PartialMutationHandlerData: (config) => config.data.requestParams,
    }),
    getOrUndefined,
  ) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends PartialHandlerData> =
  Config extends TypedPartialHandlerData
    ? Config["data"]["response"]
    : Option.None<ResponseConfig<StandardSchemaV1>>;
export type ResponseOrUndefined<Config extends PartialHandlerData> =
  GetOrUndefined<ResponseOption<Config>> extends infer Response extends
    | ResponseConfig<StandardSchemaV1>
    | undefined
    ? Response
    : never;

export const response = <const Config extends PartialHandlerData>(config: Config) =>
  pipe(
    Match.value(config as PartialHandlerData),
    Match.tagsExhaustive({
      DummyHandlerData: () => none<ResponseConfig<StandardSchemaV1>>(),
      PartialSubscriptionHandlerData: (config) => config.data.response,
      PartialMutationHandlerData: (config) => config.data.response,
    }),
    getOrUndefined,
  ) as ResponseOrUndefined<Config>;

export type ResponseErrorOption<Config extends PartialHandlerData> =
  Config extends TypedPartialHandlerData
    ? Config["data"]["responseError"]
    : Option.None<ResponseErrorConfig<StandardSchemaV1>>;
export type ResponseErrorOrUndefined<Config extends PartialHandlerData> =
  GetOrUndefined<ResponseErrorOption<Config>> extends infer ResponseError extends
    | ResponseErrorConfig<StandardSchemaV1>
    | undefined
    ? ResponseError
    : never;

export const responseError = <const Config extends PartialHandlerData>(config: Config) =>
  pipe(
    Match.value(config as PartialHandlerData),
    Match.tagsExhaustive({
      DummyHandlerData: () => none<ResponseErrorConfig<StandardSchemaV1>>(),
      PartialSubscriptionHandlerData: (config) => config.data.responseError,
      PartialMutationHandlerData: (config) => config.data.responseError,
    }),
    getOrUndefined,
  ) as ResponseErrorOrUndefined<Config>;
