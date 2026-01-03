import { Data, Function, pipe, Record, Struct, Types, Option } from "effect";
import { type BaseHandlerT, type HandlerData, type HandlerType } from "../type";
import {
  HandlerDataGroup,
  empty as emptyHandlerDataGroup,
  type AddHandlerData as GroupAddHandlerData,
  type AddHandlerDataGroup as GroupAddHandlerDataGroup,
  add as groupAddHandlerData,
  addGroup as groupAddHandlerDataGroup,
} from "./group";

export type BaseHandlerDataCollectionRecord<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerDataGroup<HT, any>;
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
    record: HandlerDataCollectionRecord;
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
    Types.Invariant.Type<C[HandlerDataCollectionTypeId]["_HandlerT"]>
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
      [HT in HandlerT as HandlerType<HT>]: HandlerDataGroup<HT, {}>;
    }
  >({
    record: Record.map(dataKeyGetters, (dataKeyGetter) =>
      emptyHandlerDataGroup(dataKeyGetter),
    ) as unknown as {
      [HT in HandlerT as HandlerType<HT>]: HandlerDataGroup<
        HT,
        Record<string | symbol, {}>
      >;
    },
    dataTypeGetter,
  });

export type AddHandlerData<
  HandlerT extends BaseHandlerT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataCollection extends HandlerDataCollection<any, any>,
  HData extends HandlerData<HandlerT>,
> =
  HandlerDataCollectionHandlerDataCollectionRecord<DataCollection> extends infer DataCollectionRecord extends
    BaseHandlerDataCollectionRecord<
      HandlerDataCollectionHandlerT<DataCollection>
    >
    ? {
        [K in keyof DataCollectionRecord]: K extends HandlerType<HandlerT>
          ? DataCollectionRecord[K] extends infer G extends HandlerDataGroup<
              HandlerT,
              any
            >
            ? HandlerDataGroup<
                HandlerT,
                GroupAddHandlerData<HandlerT, G, HData>
              >
            : never
          : DataCollectionRecord[K];
      } extends infer R extends BaseHandlerDataCollectionRecord<
        HandlerDataCollectionHandlerT<DataCollection>
      >
      ? R
      : never
    : never;

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
          ) as AddHandlerData<HandlerT, C, HData>,
      }),
    );

export type AddHandlerDataGroup<
  HandlerT extends BaseHandlerT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataCollection extends HandlerDataCollection<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGroup extends HandlerDataGroup<HandlerT, any>,
> =
  HandlerDataCollectionHandlerDataCollectionRecord<DataCollection> extends infer DataCollectionRecord extends
    BaseHandlerDataCollectionRecord<
      HandlerDataCollectionHandlerT<DataCollection>
    >
    ? {
        [K in keyof DataCollectionRecord]: K extends HandlerType<HandlerT>
          ? DataCollectionRecord[K] extends infer G extends HandlerDataGroup<
              HandlerT,
              any
            >
            ? HandlerDataGroup<
                HandlerT,
                GroupAddHandlerDataGroup<HandlerT, G, DataGroup>
              >
            : never
          : DataCollectionRecord[K];
      } extends infer R extends BaseHandlerDataCollectionRecord<
        HandlerDataCollectionHandlerT<DataCollection>
      >
      ? R
      : never
    : never;

export const addGroup =
  <
    HandlerT extends BaseHandlerT,
    const DataGroup extends HandlerDataGroup<HandlerT, any>,
  >(
    dataGroup: DataGroup,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerDataCollection<any, any>,
  >(
    handlerDataCollection: C,
  ) =>
    new HandlerDataCollection<
      HandlerDataCollectionHandlerT<C>,
      AddHandlerDataGroup<HandlerT, C, DataGroup>
    >(
      Struct.evolve(handlerDataCollection, {
        record: (record) =>
          Record.modify(
            record,
            handlerDataCollection.dataTypeGetter(
              Record.values(dataGroup.record)[0],
            ) as HandlerType<HandlerT>,
            (group: HandlerDataGroup<HandlerT, any>) =>
              pipe(
                group,
                groupAddHandlerDataGroup<HandlerT, DataGroup>(dataGroup),
              ),
          ) as unknown as AddHandlerDataGroup<HandlerT, C, DataGroup>,
      }),
    );

export type AddHandlerDataCollection<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ThisDataCollection extends HandlerDataCollection<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OtherDataCollection extends HandlerDataCollection<any, any>,
> =
  HandlerDataCollectionHandlerDataCollectionRecord<ThisDataCollection> extends infer ThisDataCollectionRecord extends
    BaseHandlerDataCollectionRecord<
      HandlerDataCollectionHandlerT<ThisDataCollection>
    >
    ? HandlerDataCollectionHandlerDataCollectionRecord<OtherDataCollection> extends infer OtherDataCollectionRecord extends
        BaseHandlerDataCollectionRecord<
          HandlerDataCollectionHandlerT<OtherDataCollection>
        >
      ? {
          [HT in
            | HandlerDataCollectionHandlerT<ThisDataCollection>
            | HandlerDataCollectionHandlerT<OtherDataCollection> as HandlerType<HT>]: HandlerDataGroup<
            HT,
            GroupAddHandlerDataGroup<
              HT,
              HandlerType<HT> extends infer T extends
                keyof ThisDataCollectionRecord
                ? ThisDataCollectionRecord[T] extends infer G extends
                    HandlerDataGroup<HT, any>
                  ? G
                  : never
                : HandlerDataGroup<HT, {}>,
              HandlerType<HT> extends infer T extends
                keyof OtherDataCollectionRecord
                ? OtherDataCollectionRecord[T] extends infer G extends
                    HandlerDataGroup<HT, any>
                  ? G
                  : never
                : HandlerDataGroup<HT, {}>
            >
          >;
        } extends infer R extends BaseHandlerDataCollectionRecord<
          | HandlerDataCollectionHandlerT<ThisDataCollection>
          | HandlerDataCollectionHandlerT<OtherDataCollection>
        >
        ? R
        : never
      : never
    : never;

export const addCollection =
  <
    const ThisC extends HandlerDataCollection<any, any>,
    const OtherC extends HandlerDataCollection<any, any>,
  >(
    otherCollection: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (thisCollection: ThisC) =>
    new HandlerDataCollection<
      | HandlerDataCollectionHandlerT<ThisC>
      | HandlerDataCollectionHandlerT<OtherC>,
      AddHandlerDataCollection<ThisC, OtherC>
    >(
      Struct.evolve(thisCollection, {
        record: (record) =>
          Record.union(
            otherCollection.record,
            (
              thisGroup: HandlerDataGroup<any, any>,
              otherGroup: HandlerDataGroup<any, any>,
            ) => pipe(thisGroup, groupAddHandlerDataGroup(otherGroup)),
          )(record) as AddHandlerDataCollection<ThisC, OtherC>,
        // TODO: figure out how to merge type getters.
        // currently in the downstream packages all instances of type getters are the same.
      }),
    );

export type GetHandlerDataGroup<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerDataCollection<any, any>,
  Type extends keyof HandlerDataCollectionHandlerDataCollectionRecord<C> &
    (string | symbol),
> = HandlerDataCollectionHandlerDataCollectionRecord<C>[Type] extends infer G extends
  HandlerDataGroup<any, any>
  ? G
  : never;

export const getHandlerDataGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerDataCollection<any, any>,
    const Type extends
      keyof HandlerDataCollectionHandlerDataCollectionRecord<C> &
        (string | symbol),
  >(
    type: Type,
  ) =>
  (handlerDataCollection: C) =>
    Record.get(handlerDataCollection.record, type) as Option.Option<
      GetHandlerDataGroup<C, Type>
    >;
