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
    HandlerDataGroupHandlerT<G>
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

// Helper type to add a single data to a HandlerDataGroupRecord
export type AddHandlerDataGroupRecord<
  HandlerT extends BaseHandlerT,
  Record extends BaseHandlerDataGroupRecord<HandlerT>,
  HData extends HandlerData<HandlerT>,
> = {
  [K in
    | keyof Record
    | (HandlerDataKey<HandlerT, HData> &
        (string | symbol))]: K extends keyof Record ? Record[K] : HData;
};

export type AddHandlerData<
  DataGroup extends HandlerDataGroup<any, any>,
  HData extends HandlerData<HandlerDataGroupHandlerT<DataGroup>>,
> = AddHandlerDataGroupRecord<
  HandlerDataGroupHandlerT<DataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<DataGroup>,
  HData
>;

export const add =
  <
    const G extends HandlerDataGroup<any, any>,
    const HData extends HandlerData<HandlerT>,
    HandlerT extends HandlerDataGroupHandlerT<G> = HandlerDataGroupHandlerT<G>,
  >(
    data: HData,
  ) =>
  (handlerDataGroup: G) =>
    new HandlerDataGroup<HandlerT, AddHandlerData<G, HData>>(
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
          ) as AddHandlerData<G, HData>,
      }),
    );

// Helper type to merge two HandlerDataGroupRecords
export type AddHandlerDataGroupGroupRecord<
  HandlerT extends BaseHandlerT,
  ThisRecord extends BaseHandlerDataGroupRecord<HandlerT>,
  OtherRecord extends BaseHandlerDataGroupRecord<HandlerT>,
> = {
  [K in keyof ThisRecord | keyof OtherRecord]: K extends keyof ThisRecord
    ? ThisRecord[K]
    : K extends keyof OtherRecord
      ? OtherRecord[K]
      : never;
};

export type AddHandlerDataGroup<
  ThisDataGroup extends HandlerDataGroup<any, any>,
  OtherDataGroup extends HandlerDataGroup<
    HandlerDataGroupHandlerT<ThisDataGroup>,
    any
  >,
> = AddHandlerDataGroupGroupRecord<
  HandlerDataGroupHandlerT<ThisDataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<ThisDataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<OtherDataGroup> extends infer R extends
    BaseHandlerDataGroupRecord<HandlerDataGroupHandlerT<ThisDataGroup>>
    ? R
    : never
>;

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerDataGroup<any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, any>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (thisGroup: ThisG) =>
    new HandlerDataGroup<
      HandlerDataGroupHandlerT<ThisG>,
      AddHandlerDataGroup<ThisG, OtherG>
    >(
      Struct.evolve(thisGroup, {
        record: (record) =>
          Record.union(
            otherGroup.record,
            (data) => data,
          )(record) as AddHandlerDataGroup<ThisG, OtherG>,
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
