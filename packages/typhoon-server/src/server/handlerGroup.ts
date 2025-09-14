import { Data, HashMap, Match, pipe } from "effect";
import {
  MutationHandlerConfig,
  SubscriptionHandlerConfig,
} from "typhoon-core/config";
import {
  AnyMutationHandlerContext,
  AnySubscriptionHandlerContext,
  MutationHandlerContext,
  SubscriptionHandlerContext,
} from "./handler";

type SubscriptionHandlerMap<R> = HashMap.HashMap<
  string,
  SubscriptionHandlerContext<SubscriptionHandlerConfig, R>
>;
type MutationHandlerMap<R> = HashMap.HashMap<
  string,
  MutationHandlerContext<MutationHandlerConfig, R>
>;

export class HandlerGroup<R = never> extends Data.TaggedClass("HandlerGroup")<{
  subscriptionHandlerMap: SubscriptionHandlerMap<R>;
  mutationHandlerMap: MutationHandlerMap<R>;
}> {}

export const empty = <R = never>() =>
  new HandlerGroup<R>({
    subscriptionHandlerMap: HashMap.empty(),
    mutationHandlerMap: HashMap.empty(),
  });

type AddHandlerGroupHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerGroup<any>,
  Handler extends AnySubscriptionHandlerContext | AnyMutationHandlerContext,
> =
  G extends HandlerGroup<infer R>
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [Handler] extends [SubscriptionHandlerContext<any, infer SR, any>]
      ? HandlerGroup<R | SR>
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [Handler] extends [MutationHandlerContext<any, infer MR, any>]
        ? HandlerGroup<R | MR>
        : never
    : never;

export const add =
  <Handler extends AnySubscriptionHandlerContext | AnyMutationHandlerContext>(
    handler: Handler,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerGroup<any>,
  >(
    handlerGroup: G,
  ): AddHandlerGroupHandler<G, Handler> => {
    const newHandlerMaps = pipe(
      Match.value(handler.config),
      Match.when({ type: "subscription" }, () => ({
        subscriptionHandlerMap: HashMap.set(
          handlerGroup.subscriptionHandlerMap,
          handler.config.name,
          handler as SubscriptionHandlerContext,
        ),
        mutationHandlerMap: handlerGroup.mutationHandlerMap,
      })),
      Match.when({ type: "mutation" }, () => ({
        subscriptionHandlerMap: handlerGroup.subscriptionHandlerMap,
        mutationHandlerMap: HashMap.set(
          handlerGroup.mutationHandlerMap,
          handler.config.name,
          handler as MutationHandlerContext,
        ),
      })),
      Match.orElseAbsurd,
    );

    return new HandlerGroup(
      newHandlerMaps,
    ) as unknown as AddHandlerGroupHandler<G, Handler>;
  };

type AddHandlerGroupHandlerGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherG extends HandlerGroup<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisG extends HandlerGroup<any>,
> =
  OtherG extends HandlerGroup<infer OtherR>
    ? ThisG extends HandlerGroup<infer ThisR>
      ? HandlerGroup<OtherR | ThisR>
      : never
    : never;

export const addGroup =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <OtherG extends HandlerGroup<any>>(otherGroup: OtherG) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ThisG extends HandlerGroup<any>>(
      thisGroup: ThisG,
    ): AddHandlerGroupHandlerGroup<ThisG, OtherG> =>
      new HandlerGroup({
        subscriptionHandlerMap: HashMap.union(
          thisGroup.subscriptionHandlerMap,
          otherGroup.subscriptionHandlerMap,
        ),
        mutationHandlerMap: HashMap.union(
          thisGroup.mutationHandlerMap,
          otherGroup.mutationHandlerMap,
        ),
      }) as unknown as AddHandlerGroupHandlerGroup<ThisG, OtherG>;
