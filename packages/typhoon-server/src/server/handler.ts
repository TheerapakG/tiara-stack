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
import { SignalContext } from "typhoon-core/signal";
import { Event } from "./event";

export type SubscriptionEventHandler<Config extends SubscriptionHandlerConfig> =
  Effect.Effect<
    StandardSchemaV1.InferInput<Config["response"]["validator"]>,
    unknown,
    Event | SignalContext | Scope.Scope
  >;

export type MutationEventHandler<Config extends MutationHandlerConfig> =
  Effect.Effect<
    StandardSchemaV1.InferInput<Config["response"]["validator"]>,
    unknown,
    Event | Scope.Scope
  >;

export type SubscriptionHandlerContextContext<
  Config extends SubscriptionHandlerConfig,
  Handler extends SubscriptionEventHandler<Config> | undefined =
    | SubscriptionEventHandler<Config>
    | undefined,
> = {
  config: Config;
  handler: Handler;
};

export type MutationHandlerContextContext<
  Config extends MutationHandlerConfig,
  Handler extends MutationEventHandler<Config> | undefined =
    | MutationEventHandler<Config>
    | undefined,
> = {
  config: Config;
  handler: Handler;
};

export type SubscriptionHandlerContext<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
  Handler extends
    SubscriptionEventHandler<Config> = SubscriptionEventHandler<Config>,
> = BaseSubscriptionHandlerContext<Config> & { handler: Handler };

export type MutationHandlerContext<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
  Handler extends MutationEventHandler<Config> = MutationEventHandler<Config>,
> = BaseMutationHandlerContext<Config> & { handler: Handler };

class HandlerContextBuilder {
  constructor() {}

  static make(): HandlerContextBuilder {
    return new HandlerContextBuilder();
  }

  private internalConfig<Config extends HandlerConfig>(
    this: HandlerContextBuilder,
    config: Config,
  ): Config extends SubscriptionHandlerConfig
    ? SubscriptionHandlerContextBuilder<Config, undefined>
    : Config extends MutationHandlerConfig
      ? MutationHandlerContextBuilder<Config, undefined>
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
      ? SubscriptionHandlerContextBuilder<Config, undefined>
      : Config extends MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config, undefined>
        : never;
  }

  config<Config extends HandlerConfig>(
    config: Config,
  ): this extends HandlerContextBuilder
    ? Config extends SubscriptionHandlerConfig
      ? SubscriptionHandlerContextBuilder<Config, undefined>
      : Config extends MutationHandlerConfig
        ? MutationHandlerContextBuilder<Config, undefined>
        : never
    : "'config' is already defined" {
    return (this as unknown as HandlerContextBuilder).internalConfig(
      config,
    ) as unknown as this extends HandlerContextBuilder
      ? Config extends SubscriptionHandlerConfig
        ? SubscriptionHandlerContextBuilder<Config, undefined>
        : Config extends MutationHandlerConfig
          ? MutationHandlerContextBuilder<Config, undefined>
          : never
      : "'config' is already defined";
  }
}

class SubscriptionHandlerContextBuilder<
  Config extends SubscriptionHandlerConfig,
  Handler extends SubscriptionEventHandler<Config> | undefined =
    | SubscriptionEventHandler<Config>
    | undefined,
> {
  constructor(
    private readonly ctx: SubscriptionHandlerContextContext<Config, Handler>,
  ) {}

  private internalHandler<Handler extends SubscriptionEventHandler<Config>>(
    this: SubscriptionHandlerContextBuilder<Config, undefined>,
    handler: Handler,
  ): SubscriptionHandlerContext<Config> {
    return { ...this.ctx, handler };
  }

  handler<Handler extends SubscriptionEventHandler<Config>>(
    handler: Handler,
  ): this extends SubscriptionHandlerContextBuilder<infer Config, undefined>
    ? SubscriptionHandlerContext<Config>
    : "'handler' is already defined" {
    return (
      this as unknown as SubscriptionHandlerContextBuilder<Config, undefined>
    ).internalHandler(
      handler,
    ) as unknown as this extends SubscriptionHandlerContextBuilder<
      infer Config,
      undefined
    >
      ? SubscriptionHandlerContext<Config>
      : "'handler' is already defined";
  }
}

class MutationHandlerContextBuilder<
  Config extends MutationHandlerConfig,
  Handler extends MutationEventHandler<Config> | undefined =
    | MutationEventHandler<Config>
    | undefined,
> {
  constructor(
    private readonly ctx: MutationHandlerContextContext<Config, Handler>,
  ) {}

  private internalHandler<Handler extends MutationEventHandler<Config>>(
    this: MutationHandlerContextBuilder<Config, undefined>,
    handler: Handler,
  ): MutationHandlerContext<Config> {
    return { ...this.ctx, handler };
  }

  handler<Handler extends MutationEventHandler<Config>>(
    handler: Handler,
  ): this extends MutationHandlerContextBuilder<infer Config, undefined>
    ? MutationHandlerContext<Config>
    : "'handler' is already defined" {
    return (
      this as unknown as MutationHandlerContextBuilder<Config, undefined>
    ).internalHandler(
      handler,
    ) as unknown as this extends MutationHandlerContextBuilder<
      infer Config,
      undefined
    >
      ? MutationHandlerContext<Config>
      : "'handler' is already defined";
  }
}

export const defineHandlerBuilder = () => {
  return HandlerContextBuilder.make();
};
