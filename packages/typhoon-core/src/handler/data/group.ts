import { Data, Function, Option, Record, Struct, Types } from "effect";
import { type BaseHandlerT, type HandlerDataKey, type HandlerData } from "../type";

export type BaseHandlerDataGroupRecord<
  HandlerT extends BaseHandlerT,
  Keys extends string = string,
> = Record<Keys, HandlerData<HandlerT>>;
export const HandlerDataGroupTypeId = Symbol("Typhoon/Handler/HandlerDataGroupTypeId");
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
>() => Variance<HandlerT, HandlerDataGroupRecord>[HandlerDataGroupTypeId] = () => ({
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
  [HandlerDataGroupTypeId] = handlerDataGroupVariance<HandlerT, HandlerDataGroupRecord>();
}

export type HandlerDataGroupHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerDataGroup<any, any>,
> = [G] extends [HandlerDataGroup<infer HandlerT, any>] ? HandlerT : never;
export type HandlerDataGroupHandlerDataGroupRecord<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerDataGroup<any, any>,
> = [G] extends [HandlerDataGroup<any, infer HandlerDataGroupRecord>]
  ? HandlerDataGroupRecord
  : never;
export type InferHandlerDataGroup<
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerDataGroup<any, any>,
> = HandlerDataGroup<HandlerDataGroupHandlerT<G>, HandlerDataGroupHandlerDataGroupRecord<G>>;

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
    | (HandlerDataKey<HandlerT, HData> & (string | symbol))]: K extends keyof Record
    ? Record[K]
    : HData;
};

export type AddHandlerData<
  DataGroup extends HandlerDataGroup<any, any>,
  HData extends HandlerData<HandlerDataGroupHandlerT<DataGroup>>,
> = AddHandlerDataGroupRecord<
  HandlerDataGroupHandlerT<DataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<DataGroup>,
  HData
>;

export const add = Function.dual<
  <
    const G extends HandlerDataGroup<any, any>,
    const HData extends HandlerData<HandlerDataGroupHandlerT<G>>,
  >(
    data: HData,
  ) => (
    handlerDataGroup: G,
  ) => HandlerDataGroup<HandlerDataGroupHandlerT<G>, AddHandlerData<G, HData>>,
  <
    const G extends HandlerDataGroup<any, any>,
    const HData extends HandlerData<HandlerDataGroupHandlerT<G>>,
  >(
    handlerDataGroup: G,
    data: HData,
  ) => HandlerDataGroup<HandlerDataGroupHandlerT<G>, AddHandlerData<G, HData>>
>(
  2,
  <
    const G extends HandlerDataGroup<any, any>,
    const HData extends HandlerData<HandlerDataGroupHandlerT<G>>,
  >(
    handlerDataGroup: G,
    data: HData,
  ) =>
    new HandlerDataGroup<HandlerDataGroupHandlerT<G>, AddHandlerData<G, HData>>(
      Struct.evolve(handlerDataGroup as InferHandlerDataGroup<G>, {
        record: (record) =>
          Record.set(
            record,
            (handlerDataGroup as InferHandlerDataGroup<G>).dataKeyGetter(data),
            data,
          ) as AddHandlerData<G, HData>,
      }),
    ),
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
} extends infer R extends BaseHandlerDataGroupRecord<
  HandlerT,
  keyof ThisRecord | keyof OtherRecord extends infer Keys extends string ? Keys : never
>
  ? R
  : never;

export type AddHandlerDataGroup<
  ThisDataGroup extends HandlerDataGroup<any, any>,
  OtherDataGroup extends HandlerDataGroup<HandlerDataGroupHandlerT<ThisDataGroup>, any>,
> = AddHandlerDataGroupGroupRecord<
  HandlerDataGroupHandlerT<ThisDataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<ThisDataGroup>,
  HandlerDataGroupHandlerDataGroupRecord<OtherDataGroup> extends infer R extends
    BaseHandlerDataGroupRecord<HandlerDataGroupHandlerT<ThisDataGroup>>
    ? R
    : never
>;

export const addGroup = Function.dual<
  <const OtherG extends HandlerDataGroup<any, any>>(
    otherGroup: OtherG,
  ) => <const ThisG extends HandlerDataGroup<HandlerDataGroupHandlerT<OtherG>, any>>(
    thisGroup: ThisG,
  ) => HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, AddHandlerDataGroup<ThisG, OtherG>>,
  <
    const ThisG extends HandlerDataGroup<any, any>,
    const OtherG extends HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, any>,
  >(
    thisGroup: ThisG,
    otherGroup: OtherG,
  ) => HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, AddHandlerDataGroup<ThisG, OtherG>>
>(
  2,
  <
    const ThisG extends HandlerDataGroup<any, any>,
    const OtherG extends HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, any>,
  >(
    thisGroup: ThisG,
    otherGroup: OtherG,
  ) =>
    new HandlerDataGroup<HandlerDataGroupHandlerT<ThisG>, AddHandlerDataGroup<ThisG, OtherG>>(
      Struct.evolve(thisGroup as InferHandlerDataGroup<ThisG>, {
        record: (record) =>
          Record.union(record, otherGroup.record, (data) => data) as AddHandlerDataGroup<
            ThisG,
            OtherG
          >,
      }),
    ),
);

export type GetHandlerData<
  G extends HandlerDataGroup<any, any>,
  Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> & string,
> = HandlerDataGroupHandlerDataGroupRecord<G>[Key] extends infer HData extends HandlerData<
  HandlerDataGroupHandlerT<G>
>
  ? HData
  : never;

export const getHandlerData = Function.dual<
  <
    const G extends HandlerDataGroup<any, any>,
    const Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> & string,
  >(
    key: Key,
  ) => (handlerDataGroup: G) => Option.Option<GetHandlerData<G, Key>>,
  <
    const G extends HandlerDataGroup<any, any>,
    const Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> & string,
  >(
    handlerDataGroup: G,
    key: Key,
  ) => Option.Option<GetHandlerData<G, Key>>
>(
  2,
  <
    const G extends HandlerDataGroup<any, any>,
    const Key extends keyof HandlerDataGroupHandlerDataGroupRecord<G> & string,
  >(
    handlerDataGroup: G,
    key: Key,
  ) => Record.get((handlerDataGroup as InferHandlerDataGroup<G>).record, key),
);
