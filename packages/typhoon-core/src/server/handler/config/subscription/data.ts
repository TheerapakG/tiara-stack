import { Data, Option } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { RequestParamsConfig } from "../shared/requestParams";
import { ResponseConfig } from "../shared/response";
import {
  type BasePartialHandlerConfig,
  type NameOption as BaseNameOption,
  type NameOrUndefined as BaseNameOrUndefined,
  type RequestParamsOption as BaseRequestParamsOption,
  type RequestParamsOrUndefined as BaseRequestParamsOrUndefined,
  type ResponseOption as BaseResponseOption,
  type ResponseOrUndefined as BaseResponseOrUndefined,
  name as baseName,
  requestParams as baseRequestParams,
  response as baseResponse,
} from "../shared/data";
import { none } from "~/utils/strictOption";

type PartialSubscriptionHandlerConfigData<
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
> = { data: BasePartialHandlerConfig<Name, RequestParams, Response> };
const PartialSubscriptionHandlerConfigTaggedClass: new <
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
>(
  args: Readonly<
    PartialSubscriptionHandlerConfigData<Name, RequestParams, Response>
  >,
) => Readonly<
  PartialSubscriptionHandlerConfigData<Name, RequestParams, Response>
> & { readonly _tag: "PartialSubscriptionHandlerConfig" } = Data.TaggedClass(
  "PartialSubscriptionHandlerConfig",
);
export class PartialSubscriptionHandlerConfig<
  const Name extends Option.Option<string> = Option.Option<string>,
  const RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  const Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
> extends PartialSubscriptionHandlerConfigTaggedClass<
  Name,
  RequestParams,
  Response
> {}

export const empty = () =>
  new PartialSubscriptionHandlerConfig({
    data: {
      name: none<string>(),
      requestParams: none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
      response: none<ResponseConfig<StandardSchemaV1>>(),
    },
  });

export type SubscriptionHandlerConfig<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<
    StandardSchemaV1,
    boolean
  > = RequestParamsConfig<StandardSchemaV1, boolean>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1>
  > = Option.Option<ResponseConfig<StandardSchemaV1>>,
> = PartialSubscriptionHandlerConfig<
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response
>;

export type NameOption<Config extends PartialSubscriptionHandlerConfig> =
  BaseNameOption<Config["data"]>;
export type NameOrUndefined<Config extends PartialSubscriptionHandlerConfig> =
  BaseNameOrUndefined<Config["data"]>;

export const name = <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => baseName(config.data) as NameOrUndefined<Config>;

export type RequestParamsOption<
  Config extends PartialSubscriptionHandlerConfig,
> = BaseRequestParamsOption<Config["data"]>;
export type RequestParamsOrUndefined<
  Config extends PartialSubscriptionHandlerConfig,
> = BaseRequestParamsOrUndefined<Config["data"]>;

export const requestParams = <
  const Config extends PartialSubscriptionHandlerConfig,
>(
  config: Config,
) => baseRequestParams(config.data) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends PartialSubscriptionHandlerConfig> =
  BaseResponseOption<Config["data"]>;
export type ResponseOrUndefined<
  Config extends PartialSubscriptionHandlerConfig,
> = BaseResponseOrUndefined<Config["data"]>;

export const response = <const Config extends PartialSubscriptionHandlerConfig>(
  config: Config,
) => baseResponse(config.data) as ResponseOrUndefined<Config>;
