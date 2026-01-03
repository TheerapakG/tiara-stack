import { Data, Function, Option, Record, Struct, Types } from "effect";
import {
  type BaseHandlerT,
  type HandlerDataKey,
  type HandlerData,
} from "../type";

export type BaseHandlerDataGroupRecord<HandlerT extends BaseHandlerT> = Record<
  string,
  HandlerData<HandlerT>
>;

export const HandlerDataGroupTypeId = Symbol(
  "Typhoon/Handler/HandlerDataGroupTypeId",
);
export type HandlerDataGroupTypeId = typeof HandlerDataGroupTypeId;

interface Variance<
  in out HandlerT extends BaseHandlerT,
  in out HandlerDataGroupRecord extends BaseHandlerDataGroupRecord<HandlerT>,
> {
  [HandlerDataGroupTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _HandlerDataGroupRecord: Types.Invariant<HandlerDataGroupRecord>;
  };
}

const handlerDataGroupVariance: <
  HandlerT extends BaseHandlerT,
  HandlerDataGroupRecord extends BaseHandlerDataGroupRecord<HandlerT>,
>() => Variance<
  HandlerT,
  HandlerDataGroupRecord
>[HandlerDataGroupTypeId] = () => ({
  _HandlerT: Function.identity,
  _HandlerDataGroupRecord: Function.identity,
});

export class HandlerDataGroup<
    HandlerT extends BaseHandlerT,
    HandlerDataGroupRecord extends BaseHandlerDataGroupRecord<HandlerT>,
  >
  extends Data.TaggedClass("HandlerDataGroup")<{
    record: HandlerDataGroupRecord;
    dataKeyGetter: (data: HandlerData<HandlerT>) => string | symbol;
  }>
  implements Variance<HandlerT, HandlerDataGroupRecord>
{
  [HandlerDataGroupTypeId] = handlerDataGroupVariance<
    HandlerT,
    HandlerDataGroupRecord
  >();
}

export type HandlerDataGroupHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerDataGroup<any, any>,
> =
  Types.Invariant.Type<
    G[HandlerDataGroupTypeId]["_HandlerT"]
  > extends infer HT extends BaseHandlerT
    ? HT
    : never;
export type HandlerDataGroupHandlerDataGroupRecord<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerDataGroup<any, any>,
> =
  Types.Invariant.Type<
    G[HandlerDataGroupTypeId]["_HandlerDataGroupRecord"]
  > extends infer R extends BaseHandlerDataGroupRecord<
    Types.Invariant.Type<G[HandlerDataGroupTypeId]["_HandlerT"]>
  >
    ? R
    : never;

export const empty = <HandlerT extends BaseHandlerT>(
  dataKeyGetter: (data: HandlerData<HandlerT>) => string | symbol,
) =>
  new HandlerDataGroup<HandlerT, {}>({
    record: {},
    dataKeyGetter,
  });

export type AddHandlerData<
  HandlerT extends BaseHandlerT,
  DataGroup extends HandlerDataGroup<HandlerT, any>,
  HData extends HandlerData<HandlerT>,
> =
  HandlerDataGroupHandlerDataGroupRecord<DataGroup> extends infer DataGroupRecord extends
    BaseHandlerDataGroupRecord<HandlerT>
    ? {
        [K in
          | keyof DataGroupRecord
          | (HandlerDataKey<HandlerT, HData> &
              (string | symbol))]: K extends keyof DataGroupRecord
          ? DataGroupRecord[K]
          : HData;
      }
    : never;

export const add =
  <HandlerT extends BaseHandlerT, const HData extends HandlerData<HandlerT>>(
    data: HData,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerDataGroup<HandlerT, any>,
  >(
    handlerDataGroup: G,
  ) =>
    new HandlerDataGroup<HandlerT, AddHandlerData<HandlerT, G, HData>>(
      Struct.evolve(handlerDataGroup, {
        record: (record) =>
          Record.set(
            record,
            handlerDataGroup.dataKeyGetter(data) as HandlerDataKey<
              HandlerT,
              HData
            > &
              (string | symbol),
            data,
          ) as AddHandlerData<HandlerT, G, HData>,
      }),
    );

export type AddHandlerDataGroup<
  HandlerT extends BaseHandlerT,
  ThisDataGroup extends HandlerDataGroup<HandlerT, any>,
  OtherDataGroup extends HandlerDataGroup<HandlerT, any>,
> =
  HandlerDataGroupHandlerDataGroupRecord<ThisDataGroup> extends infer ThisDataGroupRecord extends
    BaseHandlerDataGroupRecord<HandlerT>
    ? HandlerDataGroupHandlerDataGroupRecord<OtherDataGroup> extends infer OtherDataGroupRecord extends
        BaseHandlerDataGroupRecord<HandlerT>
      ? {
          [K in
            | keyof ThisDataGroupRecord
            | keyof OtherDataGroupRecord]: K extends keyof ThisDataGroupRecord
            ? ThisDataGroupRecord[K]
            : K extends keyof OtherDataGroupRecord
              ? OtherDataGroupRecord[K]
              : never;
        }
      : never
    : never;

export const addGroup =
  <
    HandlerT extends BaseHandlerT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerDataGroup<HandlerT, any>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisG extends HandlerDataGroup<HandlerT, any>>(thisGroup: ThisG) =>
    new HandlerDataGroup<
      HandlerT,
      AddHandlerDataGroup<HandlerT, ThisG, OtherG>
    >(
      Struct.evolve(thisGroup, {
        record: (record) =>
          Record.union(
            otherGroup.record,
            (data) => data,
          )(record) as AddHandlerDataGroup<HandlerT, ThisG, OtherG>,
      }),
    );

export type GetHandlerData<
  G extends HandlerDataGroup<any, any>,
  Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> &
    (string | symbol),
> = HandlerDataGroupHandlerDataGroupRecord<G>[Key] extends infer HData extends
  HandlerData<HandlerDataGroupHandlerT<G>>
  ? HData
  : never;

export const getHandlerData =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerDataGroup<any, any>,
    const Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> &
      (string | symbol),
  >(
    key: Key,
  ) =>
  (handlerDataGroup: G) =>
    Record.get(handlerDataGroup.record, key) as Option.Option<
      GetHandlerData<G, Key>
    >;
