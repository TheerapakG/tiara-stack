import { Match, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Context, type Type } from "typhoon-core/handler";
import { type MutationHandlerT } from "./mutation/type";
import { type SubscriptionHandlerT } from "./subscription/type";

export type HandlerContextCollection<R = never> =
  Context.Collection.HandlerContextCollection<
    MutationHandlerT | SubscriptionHandlerT,
    R
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
    const Config extends
      | Context.HandlerContext<MutationHandlerT>
      | Context.HandlerContext<SubscriptionHandlerT>,
  >(
    handlerContext: Config,
  ) =>
  <R = never>(handlerContextCollection: HandlerContextCollection<R>) =>
    Context.Collection.add(handlerContext)(handlerContextCollection);

export const addCollection =
  <OtherR = never>(otherCollection: HandlerContextCollection<OtherR>) =>
  <ThisR = never>(thisCollection: HandlerContextCollection<ThisR>) =>
    Context.Collection.addCollection(otherCollection)(thisCollection);

export const getHandlerContext =
  <HandlerT extends MutationHandlerT | SubscriptionHandlerT>(
    type: Type.HandlerType<HandlerT>,
    key: Type.HandlerDataKey<HandlerT, Type.HandlerData<HandlerT>>,
  ) =>
  <R = never>(handlerContextCollection: HandlerContextCollection<R>) =>
    Context.Collection.getHandlerContext<HandlerT>(
      type,
      key,
    )(handlerContextCollection);
