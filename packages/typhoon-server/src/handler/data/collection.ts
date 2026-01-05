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
  <const G extends Data.Group.HandlerDataGroup<any, any>>(
    handlerDataGroup: G,
  ) =>
  <const C extends HandlerDataCollection>(handlerDataCollection: C) =>
    pipe(handlerDataCollection, Data.Collection.addGroup<G>(handlerDataGroup));

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
  T extends "mutation" | "subscription",
> = Data.Collection.GetHandlerDataGroup<
  C,
  T extends Type.HandlerType<Data.Collection.HandlerDataCollectionHandlerT<C>>
    ? T
    : never
>;

export const getHandlerDataGroup =
  <
    const C extends HandlerDataCollection,
    const T extends "mutation" | "subscription",
  >(
    type: T,
  ) =>
  (handlerDataCollection: C) =>
    pipe(
      handlerDataCollection,
      Data.Collection.getHandlerDataGroup<
        C,
        T extends Type.HandlerType<
          Data.Collection.HandlerDataCollectionHandlerT<C>
        >
          ? T
          : never
      >(
        type as T extends Type.HandlerType<
          Data.Collection.HandlerDataCollectionHandlerT<C>
        >
          ? T
          : never,
      ),
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
