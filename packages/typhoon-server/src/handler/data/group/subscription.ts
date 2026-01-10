import { pipe, Option } from "effect";
import { Data, type Type } from "typhoon-core/handler";
import { type SubscriptionHandlerT } from "../../subscription/type";

export type BaseSubscriptionHandlerDataGroupRecord =
  Data.Group.BaseHandlerDataGroupRecord<SubscriptionHandlerT>;

export type SubscriptionHandlerDataGroup<
  HandlerDataGroupRecord extends
    Data.Group.BaseHandlerDataGroupRecord<SubscriptionHandlerT> = any,
> = Data.Group.HandlerDataGroup<SubscriptionHandlerT, HandlerDataGroupRecord>;

export const empty = () =>
  Data.Group.empty<SubscriptionHandlerT>((data) => data.data.name.value);

export const add =
  <const HData extends Type.HandlerData<SubscriptionHandlerT>>(
    handlerData: HData,
  ) =>
  <const G extends SubscriptionHandlerDataGroup>(handlerDataGroup: G) =>
    pipe(handlerDataGroup, Data.Group.add<G, HData>(handlerData));

export const addGroup =
  <
    const ThisG extends SubscriptionHandlerDataGroup,
    const OtherG extends Data.Group.HandlerDataGroup<
      Data.Group.HandlerDataGroupHandlerT<ThisG>,
      any
    >,
  >(
    otherGroup: OtherG,
  ) =>
  (thisGroup: ThisG) =>
    Data.Group.addGroup<ThisG, OtherG>(thisGroup, otherGroup);

export type GetHandlerDataGroupRecord<G extends SubscriptionHandlerDataGroup> =
  Data.Group.HandlerDataGroupHandlerDataGroupRecord<G>;

export type GetHandlerData<
  G extends SubscriptionHandlerDataGroup,
  Key extends keyof GetHandlerDataGroupRecord<G> & (string | symbol),
> =
  Data.Group.GetHandlerData<G, Key> extends infer HData extends
    Type.HandlerData<SubscriptionHandlerT>
    ? HData
    : never;

export const getHandlerData =
  <
    const G extends SubscriptionHandlerDataGroup,
    const Key extends keyof GetHandlerDataGroupRecord<G> & (string | symbol),
  >(
    key: Key,
  ) =>
  (handlerDataGroup: G) =>
    pipe(
      handlerDataGroup,
      Data.Group.getHandlerData<G, Key>(key),
    ) as Option.Option<GetHandlerData<G, Key>>;
