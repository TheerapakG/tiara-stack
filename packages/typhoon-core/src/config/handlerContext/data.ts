import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, Option, pipe, Scope } from "effect";
import type { DependencySignal } from "../../signal/dependencySignal";
import {
  getOrUndefined,
  GetOrUndefined,
  ValueExtends,
} from "../../utils/strictOption";
import {
  MutationHandlerConfig,
  RequestParamsConfig,
  ResolvedResponseValidator,
  ResponseConfig,
  ResponseOrUndefined,
  SubscriptionHandlerConfig,
} from "../handler";

export type { DependencySignal, GetOrUndefined, ValueExtends };

export type BaseDummyHandlerContextConfig = object;

export class DummyHandlerContextConfig extends Data.TaggedClass(
  "DummyHandlerContextConfig",
)<{
  data: BaseDummyHandlerContextConfig;
}> {}

export const empty = new DummyHandlerContextConfig({
  data: {},
});

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

export type InferSubscriptionHandlerConfig<
  Handler extends SubscriptionHandler,
> =
  Effect.Effect.Success<Handler> extends infer Signal extends DependencySignal<
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

export type SubscriptionHandlerSignalContext<
  Handler extends SubscriptionHandler,
> =
  Handler extends SubscriptionHandler<
    SubscriptionHandlerConfig,
    infer SignalR,
    unknown
  >
    ? SignalR
    : never;

export type SubscriptionHandlerEffectContext<
  Handler extends SubscriptionHandler,
> =
  Handler extends SubscriptionHandler<
    SubscriptionHandlerConfig,
    unknown,
    infer EffectR
  >
    ? EffectR
    : never;

export type SubscriptionHandlerContext<Handler extends SubscriptionHandler> =
  | SubscriptionHandlerSignalContext<Handler>
  | SubscriptionHandlerEffectContext<Handler>;

export type BasePartialSubscriptionHandlerContextConfig<
  Config extends
    Option.Option<SubscriptionHandlerConfig> = Option.Option<SubscriptionHandlerConfig>,
  Handler extends Option.Option<
    SubscriptionHandler<ValueExtends<Config, SubscriptionHandlerConfig>>
  > = Option.Option<
    SubscriptionHandler<ValueExtends<Config, SubscriptionHandlerConfig>>
  >,
> = {
  config: Config;
  handler: Handler;
};

export class PartialSubscriptionHandlerContextConfig<
  const Config extends
    Option.Option<SubscriptionHandlerConfig> = Option.Option<SubscriptionHandlerConfig>,
  const Handler extends Option.Option<
    SubscriptionHandler<ValueExtends<Config, SubscriptionHandlerConfig>>
  > = Option.Option<
    SubscriptionHandler<ValueExtends<Config, SubscriptionHandlerConfig>>
  >,
> extends Data.TaggedClass("PartialSubscriptionHandlerContextConfig")<{
  data: BasePartialSubscriptionHandlerContextConfig<Config, Handler>;
}> {}

export type SubscriptionHandlerContextConfig<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
  Handler extends SubscriptionHandler<Config> = SubscriptionHandler<Config>,
> = PartialSubscriptionHandlerContextConfig<
  Option.Some<Config>,
  Option.Some<Handler>
>;

export type SubscriptionConfigOption<
  Config extends PartialSubscriptionHandlerContextConfig,
> = Config["data"]["config"];
export type SubscriptionConfigOrUndefined<
  Config extends PartialSubscriptionHandlerContextConfig,
> = GetOrUndefined<SubscriptionConfigOption<Config>>;

export const subscriptionConfig = <
  const Config extends PartialSubscriptionHandlerContextConfig,
>(
  config: Config,
) =>
  pipe(
    config.data.config,
    getOrUndefined,
  ) as SubscriptionConfigOrUndefined<Config>;

export type SubscriptionHandlerOption<
  Config extends PartialSubscriptionHandlerContextConfig,
> = Config["data"]["handler"];
export type SubscriptionHandlerOrUndefined<
  Config extends PartialSubscriptionHandlerContextConfig,
> = GetOrUndefined<SubscriptionHandlerOption<Config>>;

export const subscriptionHandler = <
  const Config extends PartialSubscriptionHandlerContextConfig,
>(
  config: Config,
) =>
  pipe(
    config.data.handler,
    getOrUndefined,
  ) as SubscriptionHandlerOrUndefined<Config>;

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

export type InferMutationHandlerConfig<Handler extends MutationHandler> =
  Effect.Effect.Success<Handler> extends infer T
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

export type MutationHandlerContext<Handler extends MutationHandler> =
  Handler extends MutationHandler<MutationHandlerConfig, infer R> ? R : never;

export type BasePartialMutationHandlerContextConfig<
  Config extends
    Option.Option<MutationHandlerConfig> = Option.Option<MutationHandlerConfig>,
  Handler extends Option.Option<
    MutationHandler<ValueExtends<Config, MutationHandlerConfig>>
  > = Option.Option<
    MutationHandler<ValueExtends<Config, MutationHandlerConfig>>
  >,
> = {
  config: Config;
  handler: Handler;
};

export class PartialMutationHandlerContextConfig<
  const Config extends
    Option.Option<MutationHandlerConfig> = Option.Option<MutationHandlerConfig>,
  const Handler extends Option.Option<
    MutationHandler<ValueExtends<Config, MutationHandlerConfig>>
  > = Option.Option<
    MutationHandler<ValueExtends<Config, MutationHandlerConfig>>
  >,
> extends Data.TaggedClass("PartialMutationHandlerContextConfig")<{
  data: BasePartialMutationHandlerContextConfig<Config, Handler>;
}> {}

export type MutationHandlerContextConfig<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
  Handler extends MutationHandler<Config> = MutationHandler<Config>,
> = PartialMutationHandlerContextConfig<
  Option.Some<Config>,
  Option.Some<Handler>
>;

export type MutationConfigOption<
  Config extends PartialMutationHandlerContextConfig,
> = Config["data"]["config"];
export type MutationConfigOrUndefined<
  Config extends PartialMutationHandlerContextConfig,
> = GetOrUndefined<MutationConfigOption<Config>>;

export const mutationConfig = <
  const Config extends PartialMutationHandlerContextConfig,
>(
  config: Config,
) =>
  pipe(config.data.config, getOrUndefined) as MutationConfigOrUndefined<Config>;

export type MutationHandlerOption<
  Config extends PartialMutationHandlerContextConfig,
> = Config["data"]["handler"];
export type MutationHandlerOrUndefined<
  Config extends PartialMutationHandlerContextConfig,
> = GetOrUndefined<MutationHandlerOption<Config>>;

export const mutationHandler = <
  const Config extends PartialMutationHandlerContextConfig,
>(
  config: Config,
) =>
  pipe(
    config.data.handler,
    getOrUndefined,
  ) as MutationHandlerOrUndefined<Config>;
