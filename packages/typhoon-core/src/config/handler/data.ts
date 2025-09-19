import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Option, pipe } from "effect";
import { GetOrUndefined, getOrUndefined, none } from "../../utils/strictOption";

export type { GetOrUndefined };

export type BaseRequestParamsConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean = boolean,
> = {
  validator: T;
  validate: Validate;
};

export class RequestParamsConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Validate extends boolean = boolean,
> extends Data.TaggedClass("RequestParamsConfig")<
  BaseRequestParamsConfig<T, Validate>
> {}

export type RequestParamsValidator<Config extends RequestParamsConfig> =
  Config["validator"];

export type RequestParamsValidate<Config extends RequestParamsConfig> =
  Config["validate"];

export type BaseResponseConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Stream extends boolean = boolean,
> = {
  validator: T;
  stream: Stream;
};

export class ResponseConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Stream extends boolean = boolean,
> extends Data.TaggedClass("ResponseConfig")<BaseResponseConfig<T, Stream>> {}

export type ResponseValidator<Config extends ResponseConfig> =
  Config["validator"];

export type ResponseStream<Config extends ResponseConfig> = Config["stream"];

export type BaseHandlerConfig<
  HandlerType extends Option.Option<
    "subscription" | "mutation"
  > = Option.Option<"subscription" | "mutation">,
  Name extends Option.Option<string> = Option.Option<string>,
  RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> = {
  type: HandlerType;
  name: Name;
  requestParams: RequestParams;
  response: Response;
};

export class HandlerConfig<
  const HandlerType extends Option.Option<
    "subscription" | "mutation"
  > = Option.Option<"subscription" | "mutation">,
  const Name extends Option.Option<string> = Option.Option<string>,
  const RequestParams extends Option.Option<
    RequestParamsConfig<StandardSchemaV1, boolean>
  > = Option.Option<RequestParamsConfig<StandardSchemaV1, boolean>>,
  const Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> extends Data.TaggedClass("HandlerConfig")<{
  data: BaseHandlerConfig<HandlerType, Name, RequestParams, Response>;
}> {}

export type SubscriptionHandlerConfig<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<
    StandardSchemaV1,
    boolean
  > = RequestParamsConfig<StandardSchemaV1, boolean>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> = HandlerConfig<
  Option.Some<"subscription">,
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response
>;

export type MutationHandlerConfig<
  Name extends string = string,
  RequestParams extends RequestParamsConfig<
    StandardSchemaV1,
    boolean
  > = RequestParamsConfig<StandardSchemaV1, boolean>,
  Response extends Option.Option<
    ResponseConfig<StandardSchemaV1, boolean>
  > = Option.Option<ResponseConfig<StandardSchemaV1, boolean>>,
> = HandlerConfig<
  Option.Some<"mutation">,
  Option.Some<Name>,
  Option.Some<RequestParams>,
  Response
>;

export const empty = new HandlerConfig({
  data: {
    type: none<"subscription" | "mutation">(),
    name: none<string>(),
    requestParams: none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
    response: none<ResponseConfig<StandardSchemaV1, boolean>>(),
  },
});

export type TypeOption<Config extends HandlerConfig> = Config["data"]["type"];
export type TypeOrUndefined<Config extends HandlerConfig> = GetOrUndefined<
  TypeOption<Config>
>;

export const type = <const Config extends HandlerConfig>(config: Config) =>
  pipe(config.data.type, getOrUndefined) as TypeOrUndefined<Config>;

export type NameOption<Config extends HandlerConfig> = Config["data"]["name"];
export type NameOrUndefined<Config extends HandlerConfig> = GetOrUndefined<
  NameOption<Config>
>;

export const name = <const Config extends HandlerConfig>(config: Config) =>
  pipe(config.data.name, getOrUndefined) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends HandlerConfig> =
  Config["data"]["requestParams"];
export type RequestParamsOrUndefined<Config extends HandlerConfig> =
  GetOrUndefined<RequestParamsOption<Config>>;

export const requestParams = <const Config extends HandlerConfig>(
  config: Config,
) =>
  pipe(
    config.data.requestParams,
    getOrUndefined,
  ) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends HandlerConfig> =
  Config["data"]["response"];
export type ResponseOrUndefined<Config extends HandlerConfig> = GetOrUndefined<
  ResponseOption<Config>
>;

export const response = <const Config extends HandlerConfig>(config: Config) =>
  pipe(config.data.response, getOrUndefined) as ResponseOrUndefined<Config>;
