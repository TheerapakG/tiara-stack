import { Data, HashMap, Match, pipe } from "effect";
import {
  HandlerConfig,
  MutationHandlerConfig,
  name,
  SubscriptionHandlerConfig,
  type,
} from "../handler/data";
import {
  config,
  HandlerContext,
  HandlerContextConfig,
  HandlerOrUndefined,
  MutationHandler,
  MutationHandlerContextConfig,
  SubscriptionHandler,
  SubscriptionHandlerContextConfig,
} from "./data";

type SubscriptionHandlerContextConfigMap<R = never> = HashMap.HashMap<
  string,
  SubscriptionHandlerContextConfig<
    SubscriptionHandlerConfig,
    SubscriptionHandler<SubscriptionHandlerConfig, R, R>
  >
>;
type MutationHandlerContextConfigMap<R = never> = HashMap.HashMap<
  string,
  MutationHandlerContextConfig<
    MutationHandlerConfig,
    MutationHandler<MutationHandlerConfig, R>
  >
>;

export type HandlerContextConfigGroupContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextConfigGroup<any>,
> = G extends HandlerContextConfigGroup<infer Context> ? Context : never;

type AddHandlerContextConfigGroupHandlerContextConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextConfigGroup<any>,
  Config extends HandlerContextConfig,
> = HandlerContextConfigGroup<
  | HandlerContextConfigGroupContext<G>
  | HandlerContext<HandlerOrUndefined<Config>>
>;

type AddHandlerContextConfigGroupHandlerContextConfigGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherG extends HandlerContextConfigGroup<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisG extends HandlerContextConfigGroup<any>,
> = HandlerContextConfigGroup<
  | HandlerContextConfigGroupContext<ThisG>
  | HandlerContextConfigGroupContext<OtherG>
>;

export class HandlerContextConfigGroup<R = never> extends Data.TaggedClass(
  "HandlerGroup",
)<{
  subscriptionHandlerContextMap: SubscriptionHandlerContextConfigMap<R>;
  mutationHandlerContextMap: MutationHandlerContextConfigMap<R>;
}> {}

export const empty = <R = never>() =>
  new HandlerContextConfigGroup<R>({
    subscriptionHandlerContextMap: HashMap.empty(),
    mutationHandlerContextMap: HashMap.empty(),
  });

export const add =
  <const Config extends HandlerContextConfig>(handlerContextConfig: Config) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextConfigGroup<any>,
  >(
    handlerContextGroup: G,
  ): AddHandlerContextConfigGroupHandlerContextConfig<G, Config> => {
    const newHandlerMaps = pipe(
      Match.value(type(config(handlerContextConfig) as HandlerConfig)),
      Match.when("subscription", () => ({
        subscriptionHandlerContextMap: HashMap.set(
          handlerContextGroup.subscriptionHandlerContextMap,
          name(config(handlerContextConfig)),
          handlerContextConfig as SubscriptionHandlerContextConfig,
        ),
        mutationHandlerContextMap:
          handlerContextGroup.mutationHandlerContextMap,
      })),
      Match.when("mutation", () => ({
        subscriptionHandlerContextMap:
          handlerContextGroup.subscriptionHandlerContextMap,
        mutationHandlerContextMap: HashMap.set(
          handlerContextGroup.mutationHandlerContextMap,
          name(config(handlerContextConfig)),
          handlerContextConfig as MutationHandlerContextConfig,
        ),
      })),
      Match.orElseAbsurd,
    );

    return new HandlerContextConfigGroup(
      newHandlerMaps,
    ) as unknown as AddHandlerContextConfigGroupHandlerContextConfig<G, Config>;
  };

export const addGroup =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const OtherG extends HandlerContextConfigGroup<any>>(otherGroup: OtherG) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <const ThisG extends HandlerContextConfigGroup<any>>(
      thisGroup: ThisG,
    ): AddHandlerContextConfigGroupHandlerContextConfigGroup<ThisG, OtherG> =>
      new HandlerContextConfigGroup({
        subscriptionHandlerContextMap: HashMap.union(
          thisGroup.subscriptionHandlerContextMap,
          otherGroup.subscriptionHandlerContextMap,
        ),
        mutationHandlerContextMap: HashMap.union(
          thisGroup.mutationHandlerContextMap,
          otherGroup.mutationHandlerContextMap,
        ),
      }) as unknown as AddHandlerContextConfigGroupHandlerContextConfigGroup<
        ThisG,
        OtherG
      >;

export const getSubscriptionHandlerContextConfig =
  (key: string) =>
  <R = never>(handlerContextConfigGroup: HandlerContextConfigGroup<R>) =>
    HashMap.get(handlerContextConfigGroup.subscriptionHandlerContextMap, key);

export const getMutationHandlerContextConfig =
  (key: string) =>
  <R = never>(handlerContextConfigGroup: HandlerContextConfigGroup<R>) =>
    HashMap.get(handlerContextConfigGroup.mutationHandlerContextMap, key);
