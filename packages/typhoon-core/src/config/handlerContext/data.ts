import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, Option, pipe, Scope } from "effect";
import type { DependencySignal } from "../../signal/dependencySignal";
import {
  getOrUndefined,
  type GetOrUndefined,
  none,
  type ValueExtends,
} from "../../utils/strictOption";
import {
  type HandlerConfig,
  type MutationHandlerConfig,
  RequestParamsConfig,
  type ResolvedResponseValidator,
  ResponseConfig,
  type ResponseOrUndefined,
  type SubscriptionHandlerConfig,
} from "../handler";

export type { DependencySignal, GetOrUndefined, ValueExtends };

export type SubscriptionHandler<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
  SignalR = unknown,
  EffectR = unknown,
> = Effect.Effect<
  DependencySignal<
    ResolvedResponseValidator<
      ResponseOrUndefined<Config>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    > extends StandardSchemaV1<infer T, any>
      ? T
      : unknown,
    unknown,
    Scope.Scope | SignalR
  >,
  unknown,
  EffectR
>;

export type InferSubscriptionHandlerConfig<H extends SubscriptionHandler> =
  Effect.Effect.Success<H> extends infer Signal extends DependencySignal<
    unknown,
    unknown,
    unknown
  >
    ? Effect.Effect.Success<Signal> extends infer T
      ? T extends unknown
        ? SubscriptionHandlerConfig<
            string,
            RequestParamsConfig,
            Option.Option<ResponseConfig>
          >
        : SubscriptionHandlerConfig<
            string,
            RequestParamsConfig,
            | Option.Some<ResponseConfig<StandardSchemaV1<T, unknown>, boolean>>
            | Option.None<ResponseConfig>
          >
      : never
    : never;

export type SubscriptionHandlerSignalContext<H extends SubscriptionHandler> =
  H extends SubscriptionHandler<
    SubscriptionHandlerConfig,
    infer SignalR,
    unknown
  >
    ? SignalR
    : never;

export type SubscriptionHandlerEffectContext<H extends SubscriptionHandler> =
  H extends SubscriptionHandler<
    SubscriptionHandlerConfig,
    unknown,
    infer EffectR
  >
    ? EffectR
    : never;

export type SubscriptionHandlerContext<H extends SubscriptionHandler> =
  | SubscriptionHandlerSignalContext<H>
  | SubscriptionHandlerEffectContext<H>;

export type MutationHandler<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
  R = unknown,
> = Effect.Effect<
  ResolvedResponseValidator<
    ResponseOrUndefined<Config>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  > extends StandardSchemaV1<infer T, any>
    ? T
    : unknown,
  unknown,
  Scope.Scope | R
>;

export type InferMutationHandlerConfig<H extends MutationHandler> =
  Effect.Effect.Success<H> extends infer T
    ? T extends unknown
      ? MutationHandlerConfig<
          string,
          RequestParamsConfig,
          Option.Option<ResponseConfig>
        >
      : MutationHandlerConfig<
          string,
          RequestParamsConfig,
          | Option.Some<ResponseConfig<StandardSchemaV1<T, unknown>, boolean>>
          | Option.None<ResponseConfig>
        >
    : never;

export type MutationHandlerContext<H extends MutationHandler> =
  H extends MutationHandler<MutationHandlerConfig, infer R> ? R : never;

export type Handler<Config extends HandlerConfig = HandlerConfig> =
  Config extends SubscriptionHandlerConfig
    ? SubscriptionHandler<Config>
    : Config extends MutationHandlerConfig
      ? MutationHandler<Config>
      : never;

export type InferHandlerConfig<H extends Handler = Handler> =
  H extends SubscriptionHandler<SubscriptionHandlerConfig>
    ? SubscriptionHandlerConfig
    : H extends MutationHandler<MutationHandlerConfig>
      ? MutationHandlerConfig
      : never;

export type HandlerContext<H extends Handler> = H extends SubscriptionHandler
  ? SubscriptionHandlerContext<H>
  : H extends MutationHandler
    ? MutationHandlerContext<H>
    : never;

export type BasePartialHandlerContextConfig<
  Config extends Option.Option<HandlerConfig> = Option.Option<HandlerConfig>,
  H extends Option.Option<
    Handler<ValueExtends<Config, HandlerConfig>>
  > = Option.Option<Handler<ValueExtends<Config, HandlerConfig>>>,
> = {
  config: Config;
  handler: H;
};

export class PartialHandlerContextConfig<
  const Config extends
    Option.Option<HandlerConfig> = Option.Option<HandlerConfig>,
  const H extends Option.Option<
    Handler<ValueExtends<Config, HandlerConfig>>
  > = Option.Option<Handler<ValueExtends<Config, HandlerConfig>>>,
> extends Data.TaggedClass("PartialHandlerContextConfig")<{
  data: BasePartialHandlerContextConfig<Config, H>;
}> {}

export const empty = new PartialHandlerContextConfig({
  data: {
    config: none<HandlerConfig>(),
    handler: none(),
  },
});

export type SubscriptionHandlerContextConfig<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
  H extends Handler<Config> = Handler<Config>,
> = PartialHandlerContextConfig<Option.Some<Config>, Option.Some<H>>;

export type MutationHandlerContextConfig<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
  H extends Handler<Config> = Handler<Config>,
> = PartialHandlerContextConfig<Option.Some<Config>, Option.Some<H>>;

export type HandlerContextConfig<
  Config extends HandlerConfig = HandlerConfig,
  H extends Handler<Config> = Handler<Config>,
> = PartialHandlerContextConfig<Option.Some<Config>, Option.Some<H>>;

export type ConfigOption<Config extends PartialHandlerContextConfig> =
  Config["data"]["config"];
export type ConfigOrUndefined<Config extends PartialHandlerContextConfig> =
  GetOrUndefined<ConfigOption<Config>>;

export const config = <const Config extends PartialHandlerContextConfig>(
  config: Config,
) => pipe(config.data.config, getOrUndefined) as ConfigOrUndefined<Config>;

export type HandlerOption<Config extends PartialHandlerContextConfig> =
  Config["data"]["handler"];
export type HandlerOrUndefined<Config extends PartialHandlerContextConfig> =
  GetOrUndefined<HandlerOption<Config>>;

export const handler = <const Config extends PartialHandlerContextConfig>(
  config: Config,
) => pipe(config.data.handler, getOrUndefined) as HandlerOrUndefined<Config>;
