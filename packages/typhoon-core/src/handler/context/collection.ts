import {
  Data,
  Function,
  Record,
  Struct,
  Types,
  Option,
  pipe,
  Array,
} from "effect";
import {
  HandlerContextGroup,
  empty as emptyHandlerContextGroup,
  add as addHandlerContextGroup,
  addGroup as addGroupHandlerContextGroup,
  getHandlerContext as getGroupHandlerContext,
} from "./group";
import {
  type HandlerContext,
  type HandlerOrUndefined,
  type PartialHandlerContextHandlerT,
} from "./context";
import {
  type BaseHandlerT,
  type HandlerData,
  type Handler,
  type HandlerType,
  type HandlerDataKey,
  type HandlerContext as HandlerEffectContext,
} from "../type";
import {
  type AddHandlerDataCollectionCollectionRecord,
  type AddHandlerDataCollectionRecord,
  type BaseHandlerDataCollectionRecord,
} from "../data/collection";

type HandlerContextGroupRecord<HandlerT extends BaseHandlerT, R> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerContextGroup<HT, R, any>;
};
type HandlerContextTypeTransformer<HandlerT extends BaseHandlerT> = (
  handlerContext: HandlerT extends infer HT extends BaseHandlerT
    ? HandlerContext<HT, HandlerData<HT>, Handler<HT>>
    : never,
) => HandlerType<HandlerT>;

const HandlerContextCollectionTypeId = Symbol(
  "Typhoon/Handler/HandlerContextCollectionTypeId",
);
export type HandlerContextCollectionTypeId =
  typeof HandlerContextCollectionTypeId;

interface Variance<
  in out HandlerT extends BaseHandlerT,
  out R,
  in out HData extends BaseHandlerDataCollectionRecord<HandlerT>,
> {
  [HandlerContextCollectionTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
    _HData: Types.Invariant<HData>;
  };
}

const handlerContextCollectionVariance: <
  HandlerT extends BaseHandlerT,
  R,
  HData extends BaseHandlerDataCollectionRecord<HandlerT>,
>() => Variance<HandlerT, R, HData>[HandlerContextCollectionTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
  _HData: Function.identity,
});

export class HandlerContextCollection<
    HandlerT extends BaseHandlerT,
    R,
    HData extends BaseHandlerDataCollectionRecord<HandlerT>,
  >
  extends Data.TaggedClass("HandlerContextCollection")<{
    record: HandlerContextGroupRecord<HandlerT, R>;
    handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
  }>
  implements Variance<HandlerT, R, HData>
{
  [HandlerContextCollectionTypeId] = handlerContextCollectionVariance<
    HandlerT,
    R,
    HData
  >();
}

export type HandlerContextCollectionHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> =
  Types.Invariant.Type<
    C[HandlerContextCollectionTypeId]["_HandlerT"]
  > extends infer HT extends BaseHandlerT
    ? HT
    : never;
export type HandlerContextCollectionContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> =
  Types.Covariant.Type<C[HandlerContextCollectionTypeId]["_R"]> extends infer R
    ? R
    : never;
export type HandlerContextCollectionHData<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> =
  Types.Invariant.Type<
    C[HandlerContextCollectionTypeId]["_HData"]
  > extends infer HData extends BaseHandlerDataCollectionRecord<
    HandlerContextCollectionHandlerT<C>
  >
    ? HData
    : never;

type HandlerDataKeyTransformerStruct<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: (
    data: HandlerData<HT>,
  ) => HandlerDataKey<HT, HandlerData<HT>>;
};
export const empty = <HandlerT extends BaseHandlerT, R = never>(
  dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
) =>
  new HandlerContextCollection<
    HandlerT,
    R,
    {
      [HT in HandlerT as HandlerType<HT>]: {};
    }
  >({
    record: Record.fromEntries(
      pipe(
        Record.toEntries(dataKeyTransformers),
        Array.map(([type, transformer]) => [
          type as HandlerType<HandlerT>,
          emptyHandlerContextGroup<HandlerT, R>(transformer),
        ]),
      ),
    ) as unknown as HandlerContextGroupRecord<HandlerT, R>,
    handlerContextTypeTransformer,
  });

export const add =
  <
    const Config extends HandlerContext<any>,
    HandlerT extends
      PartialHandlerContextHandlerT<Config> = PartialHandlerContextHandlerT<Config>,
  >(
    handlerContextConfig: Config,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    CollectionHandlerT extends
      HandlerContextCollectionHandlerT<C> = HandlerContextCollectionHandlerT<C>,
    CollectionContext extends
      HandlerContextCollectionContext<C> = HandlerContextCollectionContext<C>,
    CollectionHData extends
      HandlerContextCollectionHData<C> = HandlerContextCollectionHData<C>,
  >(
    handlerContextCollection: C,
  ) =>
    new HandlerContextCollection<
      CollectionHandlerT,
      | CollectionContext
      | HandlerEffectContext<
          PartialHandlerContextHandlerT<Config>,
          HandlerOrUndefined<Config>
        >,
      AddHandlerDataCollectionRecord<
        CollectionHandlerT,
        HandlerT,
        CollectionHData,
        HandlerData<HandlerT>
      >
    >(
      Struct.evolve(handlerContextCollection, {
        record: (record) =>
          Record.modify(
            record,
            handlerContextCollection.handlerContextTypeTransformer(
              handlerContextConfig,
            ) as HandlerType<HandlerT>,
            (group) =>
              pipe(group, addHandlerContextGroup(handlerContextConfig)),
          ) as HandlerContextGroupRecord<
            CollectionHandlerT,
            | CollectionContext
            | HandlerEffectContext<
                PartialHandlerContextHandlerT<Config>,
                HandlerOrUndefined<Config>
              >
          >,
      }),
    );

export const addCollection =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any, any>,
    OtherHandlerT extends
      HandlerContextCollectionHandlerT<OtherC> = HandlerContextCollectionHandlerT<OtherC>,
    OtherHData extends
      HandlerContextCollectionHData<OtherC> = HandlerContextCollectionHData<OtherC>,
  >(
    otherCollection: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <
    const ThisC extends HandlerContextCollection<any, any, any>,
    ThisHandlerT extends
      HandlerContextCollectionHandlerT<ThisC> = HandlerContextCollectionHandlerT<ThisC>,
    ThisHData extends
      HandlerContextCollectionHData<ThisC> = HandlerContextCollectionHData<ThisC>,
  >(
    thisCollection: ThisC,
  ) =>
    new HandlerContextCollection<
      ThisHandlerT | OtherHandlerT,
      | HandlerContextCollectionContext<ThisC>
      | HandlerContextCollectionContext<OtherC>,
      AddHandlerDataCollectionCollectionRecord<
        ThisHandlerT,
        OtherHandlerT,
        ThisHData,
        OtherHData
      >
    >(
      Struct.evolve(thisCollection, {
        record: (record) =>
          Record.union(
            otherCollection.record,
            (
              thisGroup: HandlerContextGroup<any, any, any>,
              otherGroup: HandlerContextGroup<any, any, any>,
            ) => pipe(thisGroup, addGroupHandlerContextGroup(otherGroup)),
          )(record) as HandlerContextGroupRecord<
            ThisHandlerT | OtherHandlerT,
            | HandlerContextCollectionContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
          >,
        // TODO: figure out how to merge type transformers.
        // currently in the downstream packages all instances of type transformers are the same.
      }),
    );

export const getHandlerContext =
  <HandlerT extends BaseHandlerT>(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const C extends HandlerContextCollection<any, any, any>>(
    handlerContextCollection: C,
  ): Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
    >
  > =>
    pipe(
      Record.get(handlerContextCollection.record, type) as Option.Option<
        HandlerContextGroup<HandlerT, HandlerContextCollectionContext<C>, any>
      >,
      Option.flatMap(getGroupHandlerContext<HandlerT>(key)),
    );
