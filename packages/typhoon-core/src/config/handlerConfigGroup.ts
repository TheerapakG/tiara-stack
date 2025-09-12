import { Data, HashMap, Match, pipe } from "effect";
import { MutationHandlerConfig, SubscriptionHandlerConfig } from "./handler";

type SubscriptionHandlerConfigMap = HashMap.HashMap<
  string,
  SubscriptionHandlerConfig
>;
type MutationHandlerConfigMap = HashMap.HashMap<string, MutationHandlerConfig>;

export type HandlerConfigGroupSubscriptionHandlerConfigs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any, any>,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<infer SubscriptionHandlerConfigs, any>
    ? SubscriptionHandlerConfigs
    : never;
type HandlerConfigGroupMutationHandlerConfigs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any, any>,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any, infer MutationHandlerConfigs>
    ? MutationHandlerConfigs
    : never;

type AddHandlerConfigGroupHandlerConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any, any>,
  HandlerConfig extends SubscriptionHandlerConfig | MutationHandlerConfig,
> = [HandlerConfig] extends [SubscriptionHandlerConfig]
  ? HandlerConfigGroup<
      HandlerConfigGroupSubscriptionHandlerConfigs<G> & {
        [K in HandlerConfig["name"]]: HandlerConfig;
      },
      HandlerConfigGroupMutationHandlerConfigs<G>
    >
  : [HandlerConfig] extends [MutationHandlerConfig]
    ? HandlerConfigGroup<
        HandlerConfigGroupSubscriptionHandlerConfigs<G>,
        HandlerConfigGroupMutationHandlerConfigs<G> & {
          [K in HandlerConfig["name"]]: HandlerConfig;
        }
      >
    : never;

type AddHandlerConfigGroupHandlerConfigGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherG extends HandlerConfigGroup<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisG extends HandlerConfigGroup<any, any>,
> = HandlerConfigGroup<
  HandlerConfigGroupSubscriptionHandlerConfigs<ThisG> &
    HandlerConfigGroupSubscriptionHandlerConfigs<OtherG>,
  HandlerConfigGroupMutationHandlerConfigs<ThisG> &
    HandlerConfigGroupMutationHandlerConfigs<OtherG>
>;

export class HandlerConfigGroup<
  _SubscriptionHandlerConfigs extends Record<
    string,
    SubscriptionHandlerConfig
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  > = {},
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  _MutationHandlerConfigs extends Record<string, MutationHandlerConfig> = {},
> extends Data.TaggedClass("HandlerGroup")<{
  subscriptionHandlerMap: SubscriptionHandlerConfigMap;
  mutationHandlerMap: MutationHandlerConfigMap;
}> {
  static empty = () =>
    new HandlerConfigGroup({
      subscriptionHandlerMap: HashMap.empty(),
      mutationHandlerMap: HashMap.empty(),
    });

  static add =
    <HandlerConfig extends SubscriptionHandlerConfig | MutationHandlerConfig>(
      handlerConfig: HandlerConfig,
    ) =>
    <
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      G extends HandlerConfigGroup<any, any>,
    >(
      handlerGroup: G,
    ): AddHandlerConfigGroupHandlerConfig<G, HandlerConfig> => {
      const newHandlerMaps = pipe(
        Match.value<SubscriptionHandlerConfig | MutationHandlerConfig>(
          handlerConfig,
        ),
        Match.when({ type: "subscription" }, (handlerConfig) => ({
          subscriptionHandlerMap: HashMap.set(
            handlerGroup.subscriptionHandlerMap,
            handlerConfig.name,
            handlerConfig,
          ),
          mutationHandlerMap: handlerGroup.mutationHandlerMap,
        })),
        Match.when({ type: "mutation" }, (handlerConfig) => ({
          subscriptionHandlerMap: handlerGroup.subscriptionHandlerMap,
          mutationHandlerMap: HashMap.set(
            handlerGroup.mutationHandlerMap,
            handlerConfig.name,
            handlerConfig,
          ),
        })),
        Match.orElseAbsurd,
      );

      return new HandlerConfigGroup(
        newHandlerMaps,
      ) as unknown as AddHandlerConfigGroupHandlerConfig<G, HandlerConfig>;
    };

  static addGroup =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <OtherG extends HandlerConfigGroup<any, any>>(otherGroup: OtherG) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ThisG extends HandlerConfigGroup<any, any>>(
        thisGroup: ThisG,
      ): AddHandlerConfigGroupHandlerConfigGroup<ThisG, OtherG> =>
        new HandlerConfigGroup({
          subscriptionHandlerMap: HashMap.union(
            thisGroup.subscriptionHandlerMap,
            otherGroup.subscriptionHandlerMap,
          ),
          mutationHandlerMap: HashMap.union(
            thisGroup.mutationHandlerMap,
            otherGroup.mutationHandlerMap,
          ),
        }) as unknown as AddHandlerConfigGroupHandlerConfigGroup<ThisG, OtherG>;
}
