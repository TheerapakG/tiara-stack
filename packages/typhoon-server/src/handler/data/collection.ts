import { Match, pipe } from "effect";
import { Data, type Type } from "typhoon-core/handler";
import { type MutationHandlerT } from "../mutation/type";
import { type SubscriptionHandlerT } from "../subscription/type";

export type BaseHandlerDataCollectionRecord =
  Data.Collection.BaseHandlerDataCollectionRecord<
    MutationHandlerT | SubscriptionHandlerT
  >;

export type HandlerDataCollection<
  CollectionRecord extends BaseHandlerDataCollectionRecord = any,
> = Data.Collection.HandlerDataCollection<
  MutationHandlerT | SubscriptionHandlerT,
  CollectionRecord
>;

export const empty = () =>
  Data.Collection.empty<MutationHandlerT | SubscriptionHandlerT>(
    (data) =>
      pipe(
        Match.value(data),
        Match.tagsExhaustive({
          PartialMutationHandlerConfig: () => "mutation" as const,
          PartialSubscriptionHandlerConfig: () => "subscription" as const,
        }),
      ),
    {
      mutation: (data) => data.data.name.value,
      subscription: (data) => data.data.name.value,
    },
  );

export const add =
  <
    HandlerT extends MutationHandlerT | SubscriptionHandlerT,
    const HData extends Type.HandlerData<HandlerT>,
  >(
    handlerData: HData,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      Data.Collection.add<HandlerT, HData>(handlerData),
    );

export const addSubscription =
  <const HData extends Type.HandlerData<SubscriptionHandlerT>>(
    handlerData: HData,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(handlerDataCollection, add<SubscriptionHandlerT, HData>(handlerData));

export const addMutation =
  <const HData extends Type.HandlerData<MutationHandlerT>>(
    handlerData: HData,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(handlerDataCollection, add<MutationHandlerT, HData>(handlerData));

export const addGroup =
  <
    HandlerT extends MutationHandlerT | SubscriptionHandlerT,
    const G extends Data.Group.HandlerDataGroup<HandlerT, any>,
  >(
    handlerDataGroup: G,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      Data.Collection.addGroup<HandlerT, G>(handlerDataGroup),
    );

export const addSubscriptionGroup =
  <const G extends Data.Group.HandlerDataGroup<SubscriptionHandlerT, any>>(
    handlerDataGroup: G,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      addGroup<SubscriptionHandlerT, G>(handlerDataGroup),
    );

export const addMutationGroup =
  <const G extends Data.Group.HandlerDataGroup<MutationHandlerT, any>>(
    handlerDataGroup: G,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      addGroup<MutationHandlerT, G>(handlerDataGroup),
    );

export const addCollection =
  <const OtherC extends HandlerDataCollection>(otherCollection: OtherC) =>
  <const ThisC extends HandlerDataCollection>(handlerDataCollection: ThisC) =>
    pipe(
      handlerDataCollection,
      Data.Collection.addCollection<OtherC>(otherCollection),
    );

export type GetHandlerDataGroupOfHandlerT<
  C extends HandlerDataCollection,
  HandlerT extends MutationHandlerT | SubscriptionHandlerT,
> = Data.Collection.GetHandlerDataGroupOfHandlerT<C, HandlerT>;

export type GetHandlerDataGroup<
  C extends HandlerDataCollection,
  Key extends "subscription" | "mutation",
> = Data.Collection.GetHandlerDataGroup<C, Key>;

export const getHandlerDataGroup =
  <
    const C extends HandlerDataCollection,
    const Type extends "mutation" | "subscription",
  >(
    type: Type,
  ) =>
  (handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      Data.Collection.getHandlerDataGroup<C, Type>(type),
    );

export const getSubscriptionHandlerDataGroup = <
  const C extends HandlerDataCollection,
>(
  handlerDataCollection: C,
) =>
  pipe(
    handlerDataCollection,
    getHandlerDataGroup<C, "subscription">("subscription"),
  );

export const getMutationHandlerDataGroup = <
  const C extends HandlerDataCollection,
>(
  handlerDataCollection: C,
) =>
  pipe(handlerDataCollection, getHandlerDataGroup<C, "mutation">("mutation"));
