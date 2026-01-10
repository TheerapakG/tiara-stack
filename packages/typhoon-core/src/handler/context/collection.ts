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

export const add = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Config extends HandlerContext<any>,
  >(
    handlerContextConfig: Config,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
  >(
    handlerContextCollection: C,
  ) => HandlerContextCollection<
    HandlerContextCollectionHandlerT<C>,
    | HandlerContextCollectionContext<C>
    | HandlerEffectContext<
        PartialHandlerContextHandlerT<Config>,
        HandlerOrUndefined<Config>
      >,
    AddHandlerDataCollectionRecord<
      HandlerContextCollectionHandlerT<C>,
      PartialHandlerContextHandlerT<Config>,
      HandlerContextCollectionHData<C>,
      HandlerData<PartialHandlerContextHandlerT<Config>>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Config extends HandlerContext<any>,
  >(
    handlerContextCollection: C,
    handlerContextConfig: Config,
  ) => HandlerContextCollection<
    HandlerContextCollectionHandlerT<C>,
    | HandlerContextCollectionContext<C>
    | HandlerEffectContext<
        PartialHandlerContextHandlerT<Config>,
        HandlerOrUndefined<Config>
      >,
    AddHandlerDataCollectionRecord<
      HandlerContextCollectionHandlerT<C>,
      PartialHandlerContextHandlerT<Config>,
      HandlerContextCollectionHData<C>,
      HandlerData<PartialHandlerContextHandlerT<Config>>
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Config extends HandlerContext<any>,
  >(
    handlerContextCollection: C,
    handlerContextConfig: Config,
  ) =>
    new HandlerContextCollection<
      HandlerContextCollectionHandlerT<C>,
      | HandlerContextCollectionContext<C>
      | HandlerEffectContext<
          PartialHandlerContextHandlerT<Config>,
          HandlerOrUndefined<Config>
        >,
      AddHandlerDataCollectionRecord<
        HandlerContextCollectionHandlerT<C>,
        PartialHandlerContextHandlerT<Config>,
        HandlerContextCollectionHData<C>,
        HandlerData<PartialHandlerContextHandlerT<Config>>
      >
    >(
      Struct.evolve(handlerContextCollection, {
        record: (record) =>
          Record.modify(
            record,
            handlerContextCollection.handlerContextTypeTransformer(
              handlerContextConfig,
            ),
            addHandlerContextGroup(handlerContextConfig),
          ) as HandlerContextGroupRecord<
            HandlerContextCollectionHandlerT<C>,
            | HandlerContextCollectionContext<C>
            | HandlerEffectContext<
                PartialHandlerContextHandlerT<Config>,
                HandlerOrUndefined<Config>
              >
          >,
      }),
    ),
);

export const addCollection = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any, any>,
  >(
    otherCollection: OtherC,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisC extends HandlerContextCollection<any, any, any>,
  >(
    thisCollection: ThisC,
  ) => HandlerContextCollection<
    | HandlerContextCollectionHandlerT<ThisC>
    | HandlerContextCollectionHandlerT<OtherC>,
    | HandlerContextCollectionContext<ThisC>
    | HandlerContextCollectionContext<OtherC>,
    AddHandlerDataCollectionCollectionRecord<
      HandlerContextCollectionHandlerT<ThisC>,
      HandlerContextCollectionHandlerT<OtherC>,
      HandlerContextCollectionHData<ThisC>,
      HandlerContextCollectionHData<OtherC>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisC extends HandlerContextCollection<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any, any>,
  >(
    thisCollection: ThisC,
    otherCollection: OtherC,
  ) => HandlerContextCollection<
    | HandlerContextCollectionHandlerT<ThisC>
    | HandlerContextCollectionHandlerT<OtherC>,
    | HandlerContextCollectionContext<ThisC>
    | HandlerContextCollectionContext<OtherC>,
    AddHandlerDataCollectionCollectionRecord<
      HandlerContextCollectionHandlerT<ThisC>,
      HandlerContextCollectionHandlerT<OtherC>,
      HandlerContextCollectionHData<ThisC>,
      HandlerContextCollectionHData<OtherC>
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisC extends HandlerContextCollection<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any, any>,
  >(
    thisCollection: ThisC,
    otherCollection: OtherC,
  ) =>
    new HandlerContextCollection<
      | HandlerContextCollectionHandlerT<ThisC>
      | HandlerContextCollectionHandlerT<OtherC>,
      | HandlerContextCollectionContext<ThisC>
      | HandlerContextCollectionContext<OtherC>,
      AddHandlerDataCollectionCollectionRecord<
        HandlerContextCollectionHandlerT<ThisC>,
        HandlerContextCollectionHandlerT<OtherC>,
        HandlerContextCollectionHData<ThisC>,
        HandlerContextCollectionHData<OtherC>
      >
    >(
      Struct.evolve(thisCollection, {
        record: (record) =>
          Record.union(
            record,
            otherCollection.record,
            addGroupHandlerContextGroup,
          ) as HandlerContextGroupRecord<
            | HandlerContextCollectionHandlerT<ThisC>
            | HandlerContextCollectionHandlerT<OtherC>,
            | HandlerContextCollectionContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
          >,
      }),
    ),
);

export const getHandlerContext = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<C>,
  >(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) => (
    handlerContextCollection: C,
  ) => Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<C>,
  >(
    handlerContextCollection: C,
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) => Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
    >
  >
>(
  3,
  <
    HandlerT extends BaseHandlerT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
  >(
    handlerContextCollection: C,
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ): Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
    >
  > =>
    pipe(
      Record.get(handlerContextCollection.record, type),
      Option.flatMap(getGroupHandlerContext(key)),
    ),
);
