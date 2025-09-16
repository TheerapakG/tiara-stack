import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Option, pipe } from "effect";
import { StrictOption } from "../../utils";

export { StrictOption };

export class RequestParamsConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Validate extends boolean = boolean,
> extends Data.TaggedClass("RequestParamsConfig")<{
  validator: T;
  validate: Validate;
}> {}

export type RequestParamsValidator<Config extends RequestParamsConfig> =
  Config["validator"];

export type RequestParamsValidate<Config extends RequestParamsConfig> =
  Config["validate"];

export class ResponseConfig<
  const T extends StandardSchemaV1 = StandardSchemaV1,
  const Stream extends boolean = boolean,
> extends Data.TaggedClass("ResponseConfig")<{
  validator: T;
  stream: Stream;
}> {}

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
    type: StrictOption.none<"subscription" | "mutation">(),
    name: StrictOption.none<string>(),
    requestParams:
      StrictOption.none<RequestParamsConfig<StandardSchemaV1, boolean>>(),
    response: StrictOption.none<ResponseConfig<StandardSchemaV1, boolean>>(),
  },
});

export type TypeOption<Config extends HandlerConfig> = Config["data"]["type"];
export type TypeOrUndefined<Config extends HandlerConfig> =
  StrictOption.GetOrUndefined<TypeOption<Config>>;

export const type = <const Config extends HandlerConfig>(config: Config) =>
  pipe(
    config.data.type,
    StrictOption.getOrUndefined,
  ) as TypeOrUndefined<Config>;

export type NameOption<Config extends HandlerConfig> = Config["data"]["name"];
export type NameOrUndefined<Config extends HandlerConfig> =
  StrictOption.GetOrUndefined<NameOption<Config>>;

export const name = <const Config extends HandlerConfig>(config: Config) =>
  pipe(
    config.data.name,
    StrictOption.getOrUndefined,
  ) as NameOrUndefined<Config>;

export type RequestParamsOption<Config extends HandlerConfig> =
  Config["data"]["requestParams"];
export type RequestParamsOrUndefined<Config extends HandlerConfig> =
  StrictOption.GetOrUndefined<RequestParamsOption<Config>>;

export const requestParams = <const Config extends HandlerConfig>(
  config: Config,
) =>
  pipe(
    config.data.requestParams,
    StrictOption.getOrUndefined,
  ) as RequestParamsOrUndefined<Config>;

export type ResponseOption<Config extends HandlerConfig> =
  Config["data"]["response"];
export type ResponseOrUndefined<Config extends HandlerConfig> =
  StrictOption.GetOrUndefined<ResponseOption<Config>>;

export const response = <const Config extends HandlerConfig>(config: Config) =>
  pipe(
    config.data.response,
    StrictOption.getOrUndefined,
  ) as ResponseOrUndefined<Config>;
