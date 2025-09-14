import { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, Match, pipe, Scope } from "effect";
import {
  HandlerConfig,
  MutationHandlerConfig,
  SubscriptionHandlerConfig,
} from "typhoon-core/config";
import {
  MutationHandlerContext as BaseMutationHandlerContext,
  SubscriptionHandlerContext as BaseSubscriptionHandlerContext,
} from "typhoon-core/server";
import { DependencySignal } from "typhoon-core/signal";
import { Event } from "./event";

export type SubscriptionEventHandler<
  Config extends SubscriptionHandlerConfig,
  SignalR = never,
  EffectR = never,
> = Effect.Effect<
  DependencySignal<
    StandardSchemaV1.InferInput<Config["response"]["validator"]>,
    unknown,
    Event | Scope.Scope | SignalR
  >,
  unknown,
  EffectR
>;

export type AnySubscriptionEventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends SubscriptionHandlerConfig = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SignalR = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EffectR = any,
> = SubscriptionEventHandler<Config, SignalR, EffectR>;

type SubscriptionEventHandlerSignalContext<
  Handler extends AnySubscriptionEventHandler,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler extends SubscriptionEventHandler<any, infer SignalR, any>
    ? SignalR
    : never;

type SubscriptionEventHandlerEffectContext<
  Handler extends AnySubscriptionEventHandler,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler extends SubscriptionEventHandler<any, any, infer EffectR>
    ? EffectR
    : never;

export type MutationEventHandler<
  Config extends MutationHandlerConfig,
  R = never,
> = Effect.Effect<
  StandardSchemaV1.InferInput<Config["response"]["validator"]>,
  unknown,
  Event | Scope.Scope | R
>;

export type AnyMutationEventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends MutationHandlerConfig = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = MutationEventHandler<Config, R>;

type MutationEventHandlerContext<
  Handler extends AnyMutationEventHandler,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = Handler extends MutationEventHandler<any, infer R> ? R : never;

export type SubscriptionHandlerContextContext<
  Config extends SubscriptionHandlerConfig,
  SignalR = never,
  EffectR = never,
  Handler extends
    | AnySubscriptionEventHandler<Config, SignalR, EffectR>
    | undefined =
    | AnySubscriptionEventHandler<Config, SignalR, EffectR>
    | undefined,
> = {
  config: Config;
  handler: Handler;
};

export type MutationHandlerContextContext<
  Config extends MutationHandlerConfig,
  R = never,
  Handler extends AnyMutationEventHandler<Config, R> | undefined =
    | AnyMutationEventHandler<Config, R>
    | undefined,
> = {
  config: Config;
  handler: Handler;
};

export type SubscriptionHandlerContext<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
  SignalR = never,
  EffectR = never,
  Handler extends AnySubscriptionEventHandler<
    Config,
    SignalR,
    EffectR
  > = AnySubscriptionEventHandler<Config, SignalR, EffectR>,
> = BaseSubscriptionHandlerContext<Config> & { handler: Handler };

export type AnySubscriptionHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends SubscriptionHandlerConfig = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SignalR = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EffectR = any,
  Handler extends AnySubscriptionEventHandler<
    Config,
    SignalR,
    EffectR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  > = any,
> = SubscriptionHandlerContext<Config, SignalR, EffectR, Handler>;

export type SubscriptionHandlerContextRequirement<
  H extends AnySubscriptionHandlerContext,
> =
  H extends AnySubscriptionHandlerContext<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer SignalR,
    infer EffectR,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? SignalR | EffectR
    : never;

export type MutationHandlerContext<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
  R = never,
  Handler extends AnyMutationEventHandler<Config, R> = AnyMutationEventHandler<
    Config,
    R
  >,
> = BaseMutationHandlerContext<Config> & { handler: Handler };

export type AnyMutationHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends MutationHandlerConfig = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler extends AnyMutationEventHandler<Config, R> = any,
> = MutationHandlerContext<Config, R, Handler>;

export type MutationHandlerContextRequirement<
  H extends AnyMutationHandlerContext,
> =
  H extends AnyMutationHandlerContext<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? R
    : never;

class HandlerContextBuilder {
  constructor() {}

  static make(): HandlerContextBuilder {
    return new HandlerContextBuilder();
  }

  private internalConfig<Config extends HandlerConfig>(
    this: HandlerContextBuilder,
    config: Config,
  ): Config extends SubscriptionHandlerConfig
    ? SubscriptionHandlerContextBuilder<Config>
    : Config extends MutationHandlerConfig
      ? MutationHandlerContextBuilder<Config>
      : never {
    return pipe(
      Match.value(config as HandlerConfig),
      Match.when(
        { type: "subscription" },
        (config) =>
          new SubscriptionHandlerContextBuilder({
            config,
            handler: undefined,
          }),
      ),
      Match.when(
        { type: "mutation" },
        (config) =>
          new MutationHandlerContextBuilder({
            config,
            handler: undefined,
          }),
      ),
      Match.exhaustive,
    ) as unknown as Config extends SubscriptionHandlerConfig
      ? SubscriptionHandlerContextBuilder<Config>
      : Config extends MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config>
        : never;
  }

  config<Config extends HandlerConfig>(
    config: Config,
  ): this extends HandlerContextBuilder
    ? Config extends SubscriptionHandlerConfig
      ? SubscriptionHandlerContextBuilder<Config>
      : Config extends MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config>
        : never
    : "'config' is already defined" {
    return (this as unknown as HandlerContextBuilder).internalConfig(
      config,
    ) as unknown as this extends HandlerContextBuilder
      ? Config extends SubscriptionHandlerConfig
        ? SubscriptionHandlerContextBuilder<Config>
        : Config extends MutationHandlerConfig
          ? MutationHandlerContextBuilder<Config>
          : never
      : "'config' is already defined";
  }
}

class SubscriptionHandlerContextBuilder<
  Config extends SubscriptionHandlerConfig,
> {
  constructor(
    private readonly ctx: SubscriptionHandlerContextContext<
      Config,
      never,
      never,
      undefined
    >,
  ) {}

  handler<Handler extends AnySubscriptionEventHandler<Config>>(
    this: SubscriptionHandlerContextBuilder<Config>,
    handler: Handler,
  ): SubscriptionHandlerContext<
    Config,
    SubscriptionEventHandlerSignalContext<Handler>,
    SubscriptionEventHandlerEffectContext<Handler>,
    Handler
  > {
    return { ...this.ctx, handler };
  }
}

class MutationHandlerContextBuilder<Config extends MutationHandlerConfig> {
  constructor(
    private readonly ctx: MutationHandlerContextContext<
      Config,
      never,
      undefined
    >,
  ) {}

  handler<Handler extends AnyMutationEventHandler<Config>>(
    this: MutationHandlerContextBuilder<Config>,
    handler: Handler,
  ): MutationHandlerContext<
    Config,
    MutationEventHandlerContext<Handler>,
    Handler
  > {
    return { ...this.ctx, handler };
  }
}

export const defineHandlerBuilder = () => {
  return HandlerContextBuilder.make();
};
