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

type AddHandlerGroupHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerGroup<any, any>,
  Handler extends AnySubscriptionHandlerContext | AnyMutationHandlerContext,
> =
  G extends HandlerGroup<
    infer R,
    infer SubscriptionHandlers,
    infer MutationHandlers
  >
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [Handler] extends [SubscriptionHandlerContext<any, infer SR, any>]
      ? HandlerGroup<
          R | SR,
          SubscriptionHandlers & { [K in Handler["config"]["name"]]: Handler },
          MutationHandlers
        >
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [Handler] extends [MutationHandlerContext<any, infer MR, any>]
        ? HandlerGroup<
            R | MR,
            SubscriptionHandlers,
            MutationHandlers & { [K in Handler["config"]["name"]]: Handler }
          >
        : never
    : never;

export class HandlerGroup<
  R = never,
  _SubscriptionHandlers extends Record<
    string,
    AnySubscriptionHandlerContext
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  > = {},
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  _MutationHandlers extends Record<string, AnyMutationHandlerContext> = {},
> extends Data.TaggedClass("HandlerGroup")<{
  subscriptionHandlerMap: SubscriptionHandlerMap<R>;
  mutationHandlerMap: MutationHandlerMap<R>;
}> {
  static empty = <R = never>() =>
    new HandlerGroup<R>({
      subscriptionHandlerMap: HashMap.empty(),
      mutationHandlerMap: HashMap.empty(),
    });

  static add =
    <Handler extends AnySubscriptionHandlerContext | AnyMutationHandlerContext>(
      handler: Handler,
    ) =>
    <
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      G extends HandlerGroup<any, any, any>,
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
}
