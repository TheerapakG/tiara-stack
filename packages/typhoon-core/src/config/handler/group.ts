import { Data, HashMap, Match, pipe } from "effect";
import {
  MutationHandlerConfig,
  NameOrUndefined,
  SubscriptionHandlerConfig,
  name,
  type,
} from "./data";

type SubscriptionHandlerConfigMap = HashMap.HashMap<
  string,
  SubscriptionHandlerConfig
>;
type MutationHandlerConfigMap = HashMap.HashMap<string, MutationHandlerConfig>;

type HandlerConfigGroupSubscriptionHandlerConfigs<
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

type AddSubscriptionHandlerConfig<
  A extends Record<string, SubscriptionHandlerConfig>,
  Config extends SubscriptionHandlerConfig,
> = {
  [K in keyof A | NameOrUndefined<Config>]: K extends keyof A ? A[K] : Config;
};

type AddMutationHandlerConfig<
  A extends Record<string, MutationHandlerConfig>,
  Config extends MutationHandlerConfig,
> = {
  [K in keyof A | NameOrUndefined<Config>]: K extends keyof A ? A[K] : Config;
};

type MergeSubscriptionHandlerConfig<
  A extends Record<string, SubscriptionHandlerConfig>,
  B extends Record<string, SubscriptionHandlerConfig>,
> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

type MergeMutationHandlerConfig<
  A extends Record<string, MutationHandlerConfig>,
  B extends Record<string, MutationHandlerConfig>,
> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

type AddHandlerConfigGroupHandlerConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any, any>,
  Config extends SubscriptionHandlerConfig | MutationHandlerConfig,
> = [Config] extends [SubscriptionHandlerConfig]
  ? HandlerConfigGroup<
      AddSubscriptionHandlerConfig<
        HandlerConfigGroupSubscriptionHandlerConfigs<G>,
        Config
      >,
      HandlerConfigGroupMutationHandlerConfigs<G>
    >
  : [Config] extends [MutationHandlerConfig]
    ? HandlerConfigGroup<
        HandlerConfigGroupSubscriptionHandlerConfigs<G>,
        AddMutationHandlerConfig<
          HandlerConfigGroupMutationHandlerConfigs<G>,
          Config
        >
      >
    : never;

type AddHandlerConfigGroupHandlerConfigGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherG extends HandlerConfigGroup<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisG extends HandlerConfigGroup<any, any>,
> = HandlerConfigGroup<
  MergeSubscriptionHandlerConfig<
    HandlerConfigGroupSubscriptionHandlerConfigs<ThisG>,
    HandlerConfigGroupSubscriptionHandlerConfigs<OtherG>
  >,
  MergeMutationHandlerConfig<
    HandlerConfigGroupMutationHandlerConfigs<ThisG>,
    HandlerConfigGroupMutationHandlerConfigs<OtherG>
  >
>;

export class HandlerConfigGroup<
  _SubscriptionHandlerConfigs extends Record<
    string,
    SubscriptionHandlerConfig
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  > = {},
  _MutationHandlerConfigs extends Record<
    string,
    MutationHandlerConfig
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  > = {},
> extends Data.TaggedClass("HandlerGroup")<{
  subscriptionHandlerMap: SubscriptionHandlerConfigMap;
  mutationHandlerMap: MutationHandlerConfigMap;
}> {}

export const empty = () =>
  new HandlerConfigGroup({
    subscriptionHandlerMap: HashMap.empty(),
    mutationHandlerMap: HashMap.empty(),
  });

export const add =
  <const Config extends SubscriptionHandlerConfig | MutationHandlerConfig>(
    handlerConfig: Config,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerConfigGroup<any, any>,
  >(
    handlerGroup: G,
  ): AddHandlerConfigGroupHandlerConfig<G, Config> => {
    const newHandlerMaps = pipe(
      Match.value(
        type(
          handlerConfig as SubscriptionHandlerConfig | MutationHandlerConfig,
        ),
      ),
      Match.when("subscription", () => ({
        subscriptionHandlerMap: HashMap.set(
          handlerGroup.subscriptionHandlerMap,
          name(handlerConfig),
          handlerConfig as SubscriptionHandlerConfig,
        ),
        mutationHandlerMap: handlerGroup.mutationHandlerMap,
      })),
      Match.when("mutation", () => ({
        subscriptionHandlerMap: handlerGroup.subscriptionHandlerMap,
        mutationHandlerMap: HashMap.set(
          handlerGroup.mutationHandlerMap,
          name(handlerConfig),
          handlerConfig as MutationHandlerConfig,
        ),
      })),
      Match.orElseAbsurd,
    );

    return new HandlerConfigGroup(
      newHandlerMaps,
    ) as unknown as AddHandlerConfigGroupHandlerConfig<G, Config>;
  };

export const addGroup =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const OtherG extends HandlerConfigGroup<any, any>>(otherGroup: OtherG) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <const ThisG extends HandlerConfigGroup<any, any>>(
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
