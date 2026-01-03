import { pipe, Option } from "effect";
import { Data, type Type } from "typhoon-core/handler";
import { type MutationHandlerT } from "../../mutation/type";

export type BaseMutationHandlerDataGroupRecord =
  Data.Group.BaseHandlerDataGroupRecord<MutationHandlerT>;

export type MutationHandlerDataGroup<
  HandlerDataGroupRecord extends BaseMutationHandlerDataGroupRecord = any,
> = Data.Group.HandlerDataGroup<MutationHandlerT, HandlerDataGroupRecord>;

export const empty = () =>
  Data.Group.empty<MutationHandlerT>((data) => data.data.name.value);

export const add =
  <const HData extends Type.HandlerData<MutationHandlerT>>(
    handlerData: HData,
  ) =>
  <const G extends MutationHandlerDataGroup>(handlerDataGroup: G) =>
    pipe(
      handlerDataGroup,
      Data.Group.add<MutationHandlerT, HData>(handlerData),
    );

export const addGroup =
  <const OtherG extends MutationHandlerDataGroup>(otherGroup: OtherG) =>
  <const ThisG extends MutationHandlerDataGroup>(thisGroup: ThisG) =>
    pipe(otherGroup, Data.Group.addGroup<MutationHandlerT, ThisG>(thisGroup));

export type GetHandlerDataGroupRecord<G extends MutationHandlerDataGroup> =
  Data.Group.HandlerDataGroupHandlerDataGroupRecord<G>;

export type GetHandlerData<
  G extends MutationHandlerDataGroup,
  Key extends keyof GetHandlerDataGroupRecord<G> & (string | symbol),
> =
  Data.Group.GetHandlerData<G, Key> extends infer HData extends
    Type.HandlerData<MutationHandlerT>
    ? HData
    : never;

export const getHandlerData =
  <
    const G extends MutationHandlerDataGroup,
    const Key extends keyof GetHandlerDataGroupRecord<G> & (string | symbol),
  >(
    key: Key,
  ) =>
  (handlerDataGroup: G) =>
    pipe(
      handlerDataGroup,
      Data.Group.getHandlerData<G, Key>(key),
    ) as Option.Option<GetHandlerData<G, Key>>;
