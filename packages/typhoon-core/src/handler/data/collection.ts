import { Data, Function, pipe, Record, Struct, Types, Option } from "effect";
import { type BaseHandlerT, type HandlerData, type HandlerType } from "../type";
import {
  type BaseHandlerDataGroupRecord,
  HandlerDataGroup,
  empty as emptyHandlerDataGroup,
  type AddHandlerDataGroupRecord as GroupAddHandlerDataRecord,
  type AddHandlerDataGroupGroupRecord as GroupAddHandlerDataGroupRecord,
  type HandlerDataGroupHandlerDataGroupRecord,
  type HandlerDataGroupHandlerT,
  add as groupAddHandlerData,
  addGroup as groupAddHandlerDataGroup,
} from "./group";

export type BaseHandlerDataCollectionRecord<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: BaseHandlerDataGroupRecord<HT>;
};
export type StoredHandlerDataCollectionRecord<
  HandlerT extends BaseHandlerT,
  Base extends BaseHandlerDataCollectionRecord<HandlerT>,
> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerDataGroup<
    HT,
    HandlerType<HT> extends infer T extends keyof Base
      ? Base[T] extends infer R extends BaseHandlerDataGroupRecord<HT>
        ? R
        : never
      : never
  >;
};

export const HandlerDataCollectionTypeId = Symbol(
  "Typhoon/Handler/HandlerDataCollectionTypeId",
);
export type HandlerDataCollectionTypeId = typeof HandlerDataCollectionTypeId;

interface Variance<
  in out HandlerT extends BaseHandlerT,
  in out HandlerDataCollectionRecord extends
    BaseHandlerDataCollectionRecord<HandlerT>,
> {
  [HandlerDataCollectionTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _HandlerDataCollectionRecord: Types.Invariant<HandlerDataCollectionRecord>;
  };
}

const handlerDataCollectionVariance: <
  HandlerT extends BaseHandlerT,
  HandlerDataCollectionRecord extends BaseHandlerDataCollectionRecord<HandlerT>,
>() => Variance<
  HandlerT,
  HandlerDataCollectionRecord
>[HandlerDataCollectionTypeId] = () => ({
  _HandlerT: Function.identity,
  _HandlerDataCollectionRecord: Function.identity,
});

export class HandlerDataCollection<
    HandlerT extends BaseHandlerT,
    HandlerDataCollectionRecord extends
      BaseHandlerDataCollectionRecord<HandlerT>,
  >
  extends Data.TaggedClass("HandlerDataCollection")<{
    record: StoredHandlerDataCollectionRecord<
      HandlerT,
      HandlerDataCollectionRecord
    >;
    dataTypeGetter: (data: HandlerData<HandlerT>) => HandlerType<HandlerT>;
  }>
  implements Variance<HandlerT, HandlerDataCollectionRecord>
{
  [HandlerDataCollectionTypeId] = handlerDataCollectionVariance<
    HandlerT,
    HandlerDataCollectionRecord
  >();
}

export type HandlerDataCollectionHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
> =
  Types.Invariant.Type<
    C[HandlerDataCollectionTypeId]["_HandlerT"]
  > extends infer HT extends BaseHandlerT
    ? HT
    : never;
export type HandlerDataCollectionHandlerDataCollectionRecord<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
> =
  Types.Invariant.Type<
    C[HandlerDataCollectionTypeId]["_HandlerDataCollectionRecord"]
  > extends infer R extends BaseHandlerDataCollectionRecord<
    HandlerDataCollectionHandlerT<C>
  >
    ? R
    : never;

export const empty = <HandlerT extends BaseHandlerT>(
  dataTypeGetter: (data: HandlerData<HandlerT>) => HandlerType<HandlerT>,
  dataKeyGetters: {
    [HT in HandlerT as HandlerType<HT>]: (
      data: HandlerData<HT>,
    ) => string | symbol;
  },
) =>
  new HandlerDataCollection<
    HandlerT,
    {
      [HT in HandlerT as HandlerType<HT>]: {};
    }
  >({
    record: Record.map(dataKeyGetters, (dataKeyGetter) =>
      emptyHandlerDataGroup(dataKeyGetter),
    ) as unknown as StoredHandlerDataCollectionRecord<
      HandlerT,
      {
        [HT in HandlerT as HandlerType<HT>]: {};
      }
    >,
    dataTypeGetter,
  });

// Helper type to add a single data to a HandlerDataCollectionRecord
export type AddHandlerDataCollectionRecord<
  CollectionHandlerT extends BaseHandlerT,
  HandlerT extends BaseHandlerT,
  CollectionRecord extends BaseHandlerDataCollectionRecord<CollectionHandlerT>,
  HData extends HandlerData<HandlerT>,
> = {
  [K in keyof CollectionRecord]: K extends HandlerType<HandlerT>
    ? GroupAddHandlerDataRecord<
        HandlerT,
        CollectionRecord[K] extends BaseHandlerDataGroupRecord<HandlerT>
          ? CollectionRecord[K]
          : never,
        HData
      >
    : CollectionRecord[K];
} extends infer R extends BaseHandlerDataCollectionRecord<CollectionHandlerT>
  ? R
  : never;

export type AddHandlerData<
  HandlerT extends BaseHandlerT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataCollection extends HandlerDataCollection<any, any>,
  HData extends HandlerData<HandlerT>,
> = AddHandlerDataCollectionRecord<
  HandlerDataCollectionHandlerT<DataCollection>,
  HandlerT,
  HandlerDataCollectionHandlerDataCollectionRecord<DataCollection>,
  HData
>;

export const add =
  <HandlerT extends BaseHandlerT, const HData extends HandlerData<HandlerT>>(
    data: HData,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerDataCollection<any, any>,
  >(
    handlerDataCollection: C,
  ) =>
    new HandlerDataCollection<
      HandlerDataCollectionHandlerT<C>,
      AddHandlerData<HandlerT, C, HData>
    >(
      Struct.evolve(handlerDataCollection, {
        record: (record) =>
          Record.modify(
            record,
            handlerDataCollection.dataTypeGetter(data) as HandlerType<HandlerT>,
            (group) => pipe(group, groupAddHandlerData(data)),
          ) as StoredHandlerDataCollectionRecord<
            HandlerDataCollectionHandlerT<C>,
            AddHandlerData<HandlerT, C, HData>
          >,
      }),
    );

// Helper type to add a data group to a HandlerDataCollectionRecord
export type AddHandlerDataGroupCollectionRecord<
  CollectionHandlerT extends BaseHandlerT,
  GroupHandlerT extends BaseHandlerT,
  CollectionRecord extends BaseHandlerDataCollectionRecord<CollectionHandlerT>,
  GroupRecord extends BaseHandlerDataGroupRecord<GroupHandlerT>,
> = {
  [K in keyof CollectionRecord]: K extends HandlerType<GroupHandlerT>
    ? GroupAddHandlerDataGroupRecord<
        GroupHandlerT,
        CollectionRecord[K] extends BaseHandlerDataGroupRecord<GroupHandlerT>
          ? CollectionRecord[K]
          : never,
        GroupRecord
      >
    : CollectionRecord[K];
} extends infer R extends BaseHandlerDataCollectionRecord<CollectionHandlerT>
  ? R
  : never;

export type AddHandlerDataGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataCollection extends HandlerDataCollection<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGroup extends HandlerDataGroup<any, any>,
> = AddHandlerDataGroupCollectionRecord<
  HandlerDataCollectionHandlerT<DataCollection>,
  HandlerDataGroupHandlerT<DataGroup>,
  HandlerDataCollectionHandlerDataCollectionRecord<DataCollection>,
  HandlerDataGroupHandlerDataGroupRecord<DataGroup> extends infer R extends
    BaseHandlerDataGroupRecord<HandlerDataGroupHandlerT<DataGroup>>
    ? R
    : never
>;

export const addGroup =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const DataGroup extends HandlerDataGroup<any, any>>(dataGroup: DataGroup) =>
    <
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const C extends HandlerDataCollection<any, any>,
    >(
      handlerDataCollection: C,
    ) =>
      new HandlerDataCollection<
        HandlerDataCollectionHandlerT<C>,
        AddHandlerDataGroup<C, DataGroup>
      >(
        Struct.evolve(handlerDataCollection, {
          record: (record) =>
            Record.modify(
              record,
              handlerDataCollection.dataTypeGetter(
                Record.values(dataGroup.record)[0],
              ) as HandlerType<HandlerDataGroupHandlerT<DataGroup>>,
              (
                group: HandlerDataGroup<
                  HandlerDataGroupHandlerT<DataGroup>,
                  any
                >,
              ) => pipe(group, groupAddHandlerDataGroup(dataGroup)),
            ) as StoredHandlerDataCollectionRecord<
              HandlerDataCollectionHandlerT<C>,
              AddHandlerDataGroup<C, DataGroup>
            >,
        }),
      );

// Helper type to merge two HandlerDataCollectionRecords
export type AddHandlerDataCollectionCollectionRecord<
  ThisHandlerT extends BaseHandlerT,
  OtherHandlerT extends BaseHandlerT,
  ThisRecord extends BaseHandlerDataCollectionRecord<ThisHandlerT>,
  OtherRecord extends BaseHandlerDataCollectionRecord<OtherHandlerT>,
> = {
  [HT in
    | ThisHandlerT
    | OtherHandlerT as HandlerType<HT>]: GroupAddHandlerDataGroupRecord<
    HT,
    HandlerType<HT> extends infer T extends keyof ThisRecord
      ? ThisRecord[T] extends infer G extends BaseHandlerDataGroupRecord<HT>
        ? G
        : {}
      : {},
    HandlerType<HT> extends infer T extends keyof OtherRecord
      ? OtherRecord[T] extends infer G extends BaseHandlerDataGroupRecord<HT>
        ? G
        : {}
      : {}
  >;
};

export type AddHandlerDataCollection<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisDataCollection extends HandlerDataCollection<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherDataCollection extends HandlerDataCollection<any, any>,
> = AddHandlerDataCollectionCollectionRecord<
  HandlerDataCollectionHandlerT<ThisDataCollection>,
  HandlerDataCollectionHandlerT<OtherDataCollection>,
  HandlerDataCollectionHandlerDataCollectionRecord<ThisDataCollection>,
  HandlerDataCollectionHandlerDataCollectionRecord<OtherDataCollection>
>;

export const addCollection =
  <const OtherC extends HandlerDataCollection<any, any>>(
    otherCollection: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisC extends HandlerDataCollection<any, any>>(
    thisCollection: ThisC,
  ) =>
    new HandlerDataCollection<
      | HandlerDataCollectionHandlerT<ThisC>
      | HandlerDataCollectionHandlerT<OtherC>,
      AddHandlerDataCollection<ThisC, OtherC>
    >(
      Struct.evolve(thisCollection, {
        record: (record) =>
          Record.union(
            record,
            otherCollection.record,
            (thisGroup, otherGroup) =>
              pipe(thisGroup, groupAddHandlerDataGroup(otherGroup)),
          ) as StoredHandlerDataCollectionRecord<
            | HandlerDataCollectionHandlerT<ThisC>
            | HandlerDataCollectionHandlerT<OtherC>,
            AddHandlerDataCollection<ThisC, OtherC>
          >,
        // TODO: figure out how to merge type getters.
        // currently in the downstream packages all instances of type getters are the same.
      }),
    );

export type HandlerTOfType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
  Type extends keyof HandlerDataCollectionHandlerDataCollectionRecord<C> &
    (string | symbol),
> =
  HandlerDataCollectionHandlerT<C> extends infer HT extends BaseHandlerT
    ? HandlerType<HT> extends Type
      ? HT
      : never
    : never;

export type HandlerDataGroupRecordOfHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
  HandlerT extends BaseHandlerT,
> =
  HandlerType<HandlerT> extends infer T extends
    keyof HandlerDataCollectionHandlerDataCollectionRecord<C>
    ? HandlerDataCollectionHandlerDataCollectionRecord<C>[T] extends infer G extends
        BaseHandlerDataGroupRecord<HandlerT>
      ? G
      : never
    : never;

export type GetHandlerDataGroupOfHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
  HandlerT extends BaseHandlerT,
> = HandlerDataGroup<HandlerT, HandlerDataGroupRecordOfHandlerT<C, HandlerT>>;

export type GetHandlerDataGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
  Type extends HandlerType<HandlerDataCollectionHandlerT<C>>,
> = HandlerDataGroup<
  HandlerTOfType<C, Type>,
  HandlerDataGroupRecordOfHandlerT<C, HandlerTOfType<C, Type>>
>;

export const getHandlerDataGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerDataCollection<any, any>,
    const Type extends HandlerType<HandlerDataCollectionHandlerT<C>>,
  >(
    type: Type,
  ) =>
  (handlerDataCollection: C) =>
    Record.get(handlerDataCollection.record, type) as Option.Option<
      GetHandlerDataGroup<C, Type>
    >;
