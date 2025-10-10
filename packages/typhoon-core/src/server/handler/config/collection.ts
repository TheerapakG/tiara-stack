import { Data, Function, Match, Option, pipe, Struct, Types } from "effect";
import { type TypedHandlerConfig } from "./data";
import {
  type MutationHandlerConfig,
  type NameOrUndefined as MutationNameOrUndefined,
} from "./mutation/data";
import {
  HandlerConfigGroup,
  empty as emptyHandlerConfigGroup,
  add as addHandlerConfigGroup,
  addGroup as addGroupHandlerConfigGroup,
  getHandlerConfig as getGroupHandlerConfig,
} from "./shared/group";
import { type BaseHandlerConfig } from "./shared/data";
import {
  type SubscriptionHandlerConfig,
  type NameOrUndefined as SubscriptionNameOrUndefined,
} from "./subscription/data";

type HandlerConfigGroupStruct<
  HandlerConfig extends BaseHandlerConfig & { _tag: string },
> = {
  [tag in HandlerConfig["_tag"]]: HandlerConfigGroup<
    HandlerConfig & { _tag: tag }
  >;
};

const HandlerConfigCollectionTypeId = Symbol(
  "Typhoon/Server/HandlerConfigCollectionTypeId",
);
export type HandlerConfigCollectionTypeId =
  typeof HandlerConfigCollectionTypeId;

interface Variance<
  in out SubscriptionHandlerConfigs extends Record<
    string,
    SubscriptionHandlerConfig
  >,
  in out MutationHandlerConfigs extends Record<string, MutationHandlerConfig>,
> {
  [HandlerConfigCollectionTypeId]: {
    _SubscriptionHandlerConfigs: Types.Invariant<SubscriptionHandlerConfigs>;
    _MutationHandlerConfigs: Types.Invariant<MutationHandlerConfigs>;
  };
}

const handlerConfigCollectionVariance: <
  SubscriptionHandlerConfigs extends Record<string, SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<string, MutationHandlerConfig>,
>() => Variance<
  SubscriptionHandlerConfigs,
  MutationHandlerConfigs
>[HandlerConfigCollectionTypeId] = () => ({
  _SubscriptionHandlerConfigs: Function.identity,
  _MutationHandlerConfigs: Function.identity,
});

export class HandlerConfigCollection<
    SubscriptionHandlerConfigs extends Record<
      string,
      SubscriptionHandlerConfig
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    > = {},
    MutationHandlerConfigs extends Record<
      string,
      MutationHandlerConfig
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    > = {},
  >
  extends Data.TaggedClass("HandlerConfigCollection")<{
    struct: HandlerConfigGroupStruct<TypedHandlerConfig>;
  }>
  implements Variance<SubscriptionHandlerConfigs, MutationHandlerConfigs>
{
  [HandlerConfigCollectionTypeId] = handlerConfigCollectionVariance<
    SubscriptionHandlerConfigs,
    MutationHandlerConfigs
  >();
}

export type HandlerConfigCollectionSubscriptionHandlerConfigs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigCollection<any, any>,
> = Types.Invariant.Type<
  G[HandlerConfigCollectionTypeId]["_SubscriptionHandlerConfigs"]
>;
export type HandlerConfigCollectionMutationHandlerConfigs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigCollection<any, any>,
> = Types.Invariant.Type<
  G[HandlerConfigCollectionTypeId]["_MutationHandlerConfigs"]
>;

type AddSubscriptionHandlerConfig<
  A extends Record<string, SubscriptionHandlerConfig>,
  Config extends SubscriptionHandlerConfig,
> = {
  [K in keyof A | SubscriptionNameOrUndefined<Config>]: K extends keyof A
    ? A[K]
    : Config;
};

type AddMutationHandlerConfig<
  A extends Record<string, MutationHandlerConfig>,
  Config extends MutationHandlerConfig,
> = {
  [K in keyof A | MutationNameOrUndefined<Config>]: K extends keyof A
    ? A[K]
    : Config;
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

export const empty = () =>
  new HandlerConfigCollection({
    struct: {
      PartialSubscriptionHandlerConfig:
        emptyHandlerConfigGroup<SubscriptionHandlerConfig>(),
      PartialMutationHandlerConfig:
        emptyHandlerConfigGroup<MutationHandlerConfig>(),
    },
  });

export const add =
  <const Config extends TypedHandlerConfig>(handlerConfig: Config) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerConfigCollection<any, any>,
  >(
    handlerGroup: G,
  ) =>
    new HandlerConfigCollection<
      [Config] extends [SubscriptionHandlerConfig]
        ? AddSubscriptionHandlerConfig<
            HandlerConfigCollectionSubscriptionHandlerConfigs<G>,
            Config
          >
        : HandlerConfigCollectionSubscriptionHandlerConfigs<G>,
      [Config] extends [MutationHandlerConfig]
        ? AddMutationHandlerConfig<
            HandlerConfigCollectionMutationHandlerConfigs<G>,
            Config
          >
        : HandlerConfigCollectionMutationHandlerConfigs<G>
    >(
      pipe(
        Match.value(handlerConfig as TypedHandlerConfig),
        Match.tagsExhaustive({
          PartialSubscriptionHandlerConfig: (config) => ({
            struct: Struct.evolve(handlerGroup.struct, {
              PartialSubscriptionHandlerConfig: addHandlerConfigGroup(config),
            }),
          }),
          PartialMutationHandlerConfig: (config) => ({
            struct: Struct.evolve(handlerGroup.struct, {
              PartialMutationHandlerConfig: addHandlerConfigGroup(config),
            }),
          }),
        }),
      ),
    );

export const addCollection =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const OtherG extends HandlerConfigCollection<any, any>>(
      otherCollection: OtherG,
    ) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <const ThisG extends HandlerConfigCollection<any, any>>(
      thisCollection: ThisG,
    ) =>
      new HandlerConfigCollection<
        MergeSubscriptionHandlerConfig<
          HandlerConfigCollectionSubscriptionHandlerConfigs<ThisG>,
          HandlerConfigCollectionSubscriptionHandlerConfigs<OtherG>
        >,
        MergeMutationHandlerConfig<
          HandlerConfigCollectionMutationHandlerConfigs<ThisG>,
          HandlerConfigCollectionMutationHandlerConfigs<OtherG>
        >
      >({
        struct: Struct.evolve(thisCollection.struct, {
          PartialSubscriptionHandlerConfig: addGroupHandlerConfigGroup(
            otherCollection.struct.PartialSubscriptionHandlerConfig,
          ),
          PartialMutationHandlerConfig: addGroupHandlerConfigGroup(
            otherCollection.struct.PartialMutationHandlerConfig,
          ),
        }),
      });

export const getHandlerConfig =
  <Type extends "subscription" | "mutation", Key extends string>(
    type: Type,
    key: Key,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const C extends HandlerConfigCollection<any, any>>(
    handlerConfigCollection: C,
  ) =>
    pipe(
      Match.value(type as "subscription" | "mutation"),
      Match.when("subscription", () =>
        getGroupHandlerConfig(key)(
          handlerConfigCollection.struct.PartialSubscriptionHandlerConfig,
        ),
      ),
      Match.when("mutation", () =>
        getGroupHandlerConfig(key)(
          handlerConfigCollection.struct.PartialMutationHandlerConfig,
        ),
      ),
      Match.exhaustive,
    ) as Type extends "subscription"
      ? Option.Option<HandlerConfigCollectionSubscriptionHandlerConfigs<C>[Key]>
      : Type extends "mutation"
        ? Option.Option<HandlerConfigCollectionMutationHandlerConfigs<C>[Key]>
        : never;
