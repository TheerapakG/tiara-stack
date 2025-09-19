import { Match, pipe, Struct } from "effect";
import { StrictOption } from "../../utils";
import {
  MutationHandlerConfig,
  SubscriptionHandlerConfig,
  type,
} from "../handler";
import {
  DummyHandlerContextConfig,
  InferMutationHandlerConfig,
  InferSubscriptionHandlerConfig,
  MutationConfigOption,
  MutationHandler,
  PartialMutationHandlerContextConfig,
  PartialSubscriptionHandlerContextConfig,
  SubscriptionConfigOption,
  SubscriptionHandler,
  ValueExtends,
} from "./data";

import { Option } from "effect";

type SetConfigInput = DummyHandlerContextConfig;
type SetConfigOutput<
  Config extends SubscriptionHandlerConfig | MutationHandlerConfig,
> = Config extends SubscriptionHandlerConfig
  ? PartialSubscriptionHandlerContextConfig<
      Option.Some<Config>,
      Option.None<SubscriptionHandler<Config>>
    >
  : Config extends MutationHandlerConfig
    ? PartialMutationHandlerContextConfig<
        Option.Some<Config>,
        Option.None<MutationHandler<Config>>
      >
    : never;

export const config =
  <const Config extends SubscriptionHandlerConfig | MutationHandlerConfig>(
    config: Config,
  ) =>
  <const Input extends SetConfigInput>(_: Input) =>
    pipe(
      Match.value(
        type(config as SubscriptionHandlerConfig | MutationHandlerConfig),
      ),
      Match.when(
        "subscription",
        () =>
          new PartialSubscriptionHandlerContextConfig({
            data: {
              config: StrictOption.some(
                config as Config extends SubscriptionHandlerConfig
                  ? Config
                  : never,
              ),
              handler: StrictOption.none(),
            },
          }),
      ),
      Match.when(
        "mutation",
        () =>
          new PartialMutationHandlerContextConfig({
            data: {
              config: StrictOption.some(
                config as Config extends MutationHandlerConfig ? Config : never,
              ),
              handler: StrictOption.none(),
            },
          }),
      ),
      Match.orElseAbsurd,
    ) as unknown as SetConfigOutput<Config>;

type SetSubscriptionHandlerInput<Handler extends SubscriptionHandler> =
  PartialSubscriptionHandlerContextConfig<
    Option.Some<InferSubscriptionHandlerConfig<Handler>>,
    Option.None<SubscriptionHandler<InferSubscriptionHandlerConfig<Handler>>>
  >;
type SetMutationHandlerInput<Handler extends MutationHandler> =
  PartialMutationHandlerContextConfig<
    Option.Some<InferMutationHandlerConfig<Handler>>,
    Option.None<MutationHandler<InferMutationHandlerConfig<Handler>>>
  >;
type SetHandlerInput<Handler extends SubscriptionHandler | MutationHandler> =
  Handler extends SubscriptionHandler
    ? SetSubscriptionHandlerInput<Handler>
    : Handler extends MutationHandler
      ? SetMutationHandlerInput<Handler>
      : never;

type SetSubscriptionHandlerOutput<
  Handler extends SubscriptionHandler,
  Config extends SetSubscriptionHandlerInput<Handler>,
> =
  SubscriptionConfigOption<Config> extends infer InferConfig extends
    Option.Some<InferSubscriptionHandlerConfig<Handler>>
    ? Handler extends infer InferHandler extends SubscriptionHandler<
        ValueExtends<InferConfig, SubscriptionHandlerConfig>,
        unknown,
        unknown
      >
      ? PartialSubscriptionHandlerContextConfig<
          InferConfig,
          Option.Some<InferHandler>
        >
      : never
    : never;
type SetMutationHandlerOutput<
  Handler extends MutationHandler,
  Config extends SetMutationHandlerInput<Handler>,
> =
  MutationConfigOption<Config> extends infer InferConfig extends Option.Some<
    InferMutationHandlerConfig<Handler>
  >
    ? Handler extends infer InferHandler extends MutationHandler<
        ValueExtends<InferConfig, MutationHandlerConfig>,
        unknown
      >
      ? PartialMutationHandlerContextConfig<
          InferConfig,
          Option.Some<InferHandler>
        >
      : never
    : never;
type SetHandlerOutput<
  Handler extends SubscriptionHandler | MutationHandler,
  Config extends SetHandlerInput<Handler>,
> = Handler extends SubscriptionHandler
  ? Config extends SetSubscriptionHandlerInput<Handler>
    ? SetSubscriptionHandlerOutput<Handler, Config>
    : never
  : Handler extends MutationHandler
    ? Config extends SetMutationHandlerInput<Handler>
      ? SetMutationHandlerOutput<Handler, Config>
      : never
    : never;

export const handler =
  <const Handler extends SubscriptionHandler | MutationHandler>(
    handler: Handler,
  ) =>
  <const Config extends SetHandlerInput<Handler>>(config: Config) =>
    pipe(
      Match.value(
        config as
          | PartialSubscriptionHandlerContextConfig
          | PartialMutationHandlerContextConfig,
      ),
      Match.tagsExhaustive({
        PartialSubscriptionHandlerContextConfig: (config) =>
          new PartialSubscriptionHandlerContextConfig({
            data: Struct.evolve(config.data, {
              handler: () => StrictOption.some(handler as SubscriptionHandler),
            }),
          }),
        PartialMutationHandlerContextConfig: (config) =>
          new PartialMutationHandlerContextConfig({
            data: Struct.evolve(config.data, {
              handler: () => StrictOption.some(handler as MutationHandler),
            }),
          }),
      }),
    ) as unknown as SetHandlerOutput<Handler, Config>;
