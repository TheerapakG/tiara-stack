import { Match, Option, pipe } from "effect";
import { Data as CoreData, Context, type Type } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { type MutationHandlerT } from "../mutation/type";
import { type SubscriptionHandlerT } from "../subscription/type";

export const HandlerDataGroupTypeId = CoreData.Collection.HandlerDataCollectionTypeId;
export const HandlerDataCollectionTypeId = CoreData.Collection.HandlerDataCollectionTypeId;

export type HandlerContextCollection<R = never> = Context.Collection.HandlerContextCollection<
  MutationHandlerT | SubscriptionHandlerT,
  R,
  any
>;

export const empty = <R = never>() =>
  Context.Collection.empty<MutationHandlerT | SubscriptionHandlerT, R>(
    {
      mutation: (config) => Handler.Config.Mutation.name(config),
      subscription: (config) => Handler.Config.Subscription.name(config),
    },
    (context) =>
      pipe(
        Match.value(Context.data(context)),
        Match.tagsExhaustive({
          PartialMutationHandlerConfig: () => "mutation" as const,
          PartialSubscriptionHandlerConfig: () => "subscription" as const,
        }),
      ),
  );

export const add =
  <
    const Collection extends HandlerContextCollection<any>,
    const Config extends Context.HandlerContext<HandlerT>,
    HandlerT extends (MutationHandlerT | SubscriptionHandlerT) &
      Context.Collection.HandlerContextCollectionHandlerT<Collection>,
  >(
    handlerContext: Config,
  ) =>
  (handlerContextCollection: Collection) =>
    Context.Collection.add<Collection, HandlerT, Config>(handlerContextCollection, handlerContext);

export const addSubscription =
  <
    const Collection extends HandlerContextCollection<any>,
    const Config extends Context.HandlerContext<
      SubscriptionHandlerT & Context.Collection.HandlerContextCollectionHandlerT<Collection>
    >,
  >(
    handlerContext: Config,
  ) =>
  (handlerContextCollection: Collection) =>
    Context.Collection.add<
      Collection,
      SubscriptionHandlerT & Context.Collection.HandlerContextCollectionHandlerT<Collection>,
      Config
    >(handlerContextCollection, handlerContext);

export const addMutation =
  <
    const Collection extends HandlerContextCollection<any>,
    const Config extends Context.HandlerContext<
      MutationHandlerT & Context.Collection.HandlerContextCollectionHandlerT<Collection>
    >,
  >(
    handlerContext: Config,
  ) =>
  (handlerContextCollection: Collection) =>
    Context.Collection.add<
      Collection,
      MutationHandlerT & Context.Collection.HandlerContextCollectionHandlerT<Collection>,
      Config
    >(handlerContextCollection, handlerContext);

export const addCollection =
  <OtherCollection extends HandlerContextCollection<any>>(otherCollection: OtherCollection) =>
  <ThisCollection extends HandlerContextCollection<any>>(thisCollection: ThisCollection) =>
    Context.Collection.addCollection(thisCollection, otherCollection);

export const getHandlerContext =
  <HandlerT extends MutationHandlerT | SubscriptionHandlerT>(
    type: Type.HandlerType<HandlerT>,
    key: Type.HandlerDataKey<HandlerT, Type.HandlerData<HandlerT>>,
  ) =>
  <R = never>(
    handlerContextCollection: HandlerContextCollection<R>,
  ): Option.Option<
    Context.HandlerContext<
      HandlerT,
      Type.HandlerData<HandlerT>,
      Type.Handler<HandlerT, unknown, unknown, R>
    >
  > =>
    Context.Collection.getHandlerContext<HandlerContextCollection<R>, HandlerT>(
      handlerContextCollection,
      type,
      key,
    );

export const getMutationHandlerContext =
  (key: string) =>
  <R = never>(
    handlerContextCollection: HandlerContextCollection<R>,
  ): Option.Option<
    Context.HandlerContext<
      MutationHandlerT,
      Type.HandlerData<MutationHandlerT>,
      Type.Handler<MutationHandlerT, unknown, unknown, R>
    >
  > =>
    getHandlerContext<MutationHandlerT>("mutation", key)(handlerContextCollection);

export const getSubscriptionHandlerContext =
  (key: string) =>
  <R = never>(
    handlerContextCollection: HandlerContextCollection<R>,
  ): Option.Option<
    Context.HandlerContext<
      SubscriptionHandlerT,
      Type.HandlerData<SubscriptionHandlerT>,
      Type.Handler<SubscriptionHandlerT, unknown, unknown, R>
    >
  > =>
    getHandlerContext<SubscriptionHandlerT>("subscription", key)(handlerContextCollection);
