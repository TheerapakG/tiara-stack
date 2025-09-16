import { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, Match, pipe, Scope } from "effect";
import { HandlerConfig } from "typhoon-core/config";
import {
  MutationHandlerContext as BaseMutationHandlerContext,
  SubscriptionHandlerContext as BaseSubscriptionHandlerContext,
} from "typhoon-core/server";
import { DependencySignal } from "typhoon-core/signal";
import { Event } from "./event";

type ResolvedResponseValidator<Config extends HandlerConfig.HandlerConfig> =
  HandlerConfig.ResolvedResponseValidator<
    HandlerConfig.ResponseOrUndefined<Config>
  >;

export type SubscriptionEventHandler<
  Config extends HandlerConfig.SubscriptionHandlerConfig,
  SignalR = never,
  EffectR = never,
> = Effect.Effect<
  DependencySignal<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResolvedResponseValidator<Config> extends StandardSchemaV1<infer T, any>
      ? T
      : unknown,
    unknown,
    Event | Scope.Scope | SignalR
  >,
  unknown,
  EffectR
>;

export type AnySubscriptionEventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends HandlerConfig.SubscriptionHandlerConfig = any,
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
  Config extends HandlerConfig.MutationHandlerConfig,
  R = never,
> = Effect.Effect<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ResolvedResponseValidator<Config> extends StandardSchemaV1<infer T, any>
    ? T
    : unknown,
  unknown,
  Event | Scope.Scope | R
>;

export type AnyMutationEventHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends HandlerConfig.MutationHandlerConfig = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = MutationEventHandler<Config, R>;

type MutationEventHandlerContext<
  Handler extends AnyMutationEventHandler,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = Handler extends MutationEventHandler<any, infer R> ? R : never;

export type SubscriptionHandlerContextContext<
  Config extends HandlerConfig.SubscriptionHandlerConfig,
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
  Config extends HandlerConfig.MutationHandlerConfig,
  R = never,
  Handler extends AnyMutationEventHandler<Config, R> | undefined =
    | AnyMutationEventHandler<Config, R>
    | undefined,
> = {
  config: Config;
  handler: Handler;
};

export type SubscriptionHandlerContext<
  Config extends
    HandlerConfig.SubscriptionHandlerConfig = HandlerConfig.SubscriptionHandlerConfig,
  SignalR = never,
  EffectR = never,
  Handler extends AnySubscriptionEventHandler<
    Config,
    SignalR,
    EffectR
  > = AnySubscriptionEventHandler<Config, SignalR, EffectR>,
> = BaseSubscriptionHandlerContext<Config> & { handler: Handler };

export type AnySubscriptionHandlerContext<
  Config extends
    HandlerConfig.SubscriptionHandlerConfig = HandlerConfig.SubscriptionHandlerConfig,
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
  Config extends
    HandlerConfig.MutationHandlerConfig = HandlerConfig.MutationHandlerConfig,
  R = never,
  Handler extends AnyMutationEventHandler<Config, R> = AnyMutationEventHandler<
    Config,
    R
  >,
> = BaseMutationHandlerContext<Config> & { handler: Handler };

export type AnyMutationHandlerContext<
  Config extends
    HandlerConfig.MutationHandlerConfig = HandlerConfig.MutationHandlerConfig,
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

  private internalConfig<
    Config extends
      | HandlerConfig.SubscriptionHandlerConfig
      | HandlerConfig.MutationHandlerConfig,
  >(
    this: HandlerContextBuilder,
    config: Config,
  ): Config extends HandlerConfig.SubscriptionHandlerConfig
    ? SubscriptionHandlerContextBuilder<Config>
    : Config extends HandlerConfig.MutationHandlerConfig
      ? MutationHandlerContextBuilder<Config>
      : never {
    return pipe(
      Match.value({
        type: HandlerConfig.type(
          config as
            | HandlerConfig.SubscriptionHandlerConfig
            | HandlerConfig.MutationHandlerConfig,
        ),
      }),
      Match.when(
        { type: "subscription" },
        () =>
          new SubscriptionHandlerContextBuilder({
            config: config as HandlerConfig.SubscriptionHandlerConfig,
            handler: undefined,
          }),
      ),
      Match.when(
        { type: "mutation" },
        () =>
          new MutationHandlerContextBuilder({
            config: config as HandlerConfig.MutationHandlerConfig,
            handler: undefined,
          }),
      ),
      Match.exhaustive,
    ) as unknown as Config extends HandlerConfig.SubscriptionHandlerConfig
      ? SubscriptionHandlerContextBuilder<Config>
      : Config extends HandlerConfig.MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config>
        : never;
  }

  config<
    Config extends
      | HandlerConfig.SubscriptionHandlerConfig
      | HandlerConfig.MutationHandlerConfig,
  >(
    config: Config,
  ): this extends HandlerContextBuilder
    ? Config extends HandlerConfig.SubscriptionHandlerConfig
      ? SubscriptionHandlerContextBuilder<Config>
      : Config extends HandlerConfig.MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config>
        : never
    : "'config' is already defined" {
    return (this as unknown as HandlerContextBuilder).internalConfig(
      config,
    ) as unknown as this extends HandlerContextBuilder
      ? Config extends HandlerConfig.SubscriptionHandlerConfig
        ? SubscriptionHandlerContextBuilder<Config>
        : Config extends HandlerConfig.MutationHandlerConfig
          ? MutationHandlerContextBuilder<Config>
          : never
      : "'config' is already defined";
  }
}

class SubscriptionHandlerContextBuilder<
  Config extends HandlerConfig.SubscriptionHandlerConfig,
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

class MutationHandlerContextBuilder<
  Config extends HandlerConfig.MutationHandlerConfig,
> {
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
