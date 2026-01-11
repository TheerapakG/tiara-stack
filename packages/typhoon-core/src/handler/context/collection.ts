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
  type DataOrUndefined,
  type HandlerContext,
  type HandlerOrUndefined,
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
> = [C] extends [HandlerContextCollection<infer HandlerT, any, any>]
  ? HandlerT
  : never;
export type HandlerContextCollectionContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> = [C] extends [HandlerContextCollection<any, infer R, any>] ? R : never;
export type HandlerContextCollectionHData<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> = [C] extends [HandlerContextCollection<any, any, infer HData>]
  ? HData
  : never;

export type InferHandlerContextCollection<
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any, any>,
> = HandlerContextCollection<
  HandlerContextCollectionHandlerT<C>,
  HandlerContextCollectionContext<C>,
  HandlerContextCollectionHData<C>
>;

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
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<C>,
    const Config extends HandlerContext<HandlerT>,
  >(
    handlerContextConfig: Config,
  ) => (
    handlerContextCollection: C,
  ) => HandlerContextCollection<
    HandlerContextCollectionHandlerT<C>,
    | HandlerContextCollectionContext<C>
    | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>,
    AddHandlerDataCollectionRecord<
      HandlerContextCollectionHandlerT<C>,
      HandlerT,
      HandlerContextCollectionHData<C>,
      DataOrUndefined<Config>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<C>,
    const Config extends HandlerContext<HandlerT>,
  >(
    handlerContextCollection: C,
    handlerContextConfig: Config,
  ) => HandlerContextCollection<
    HandlerContextCollectionHandlerT<C>,
    | HandlerContextCollectionContext<C>
    | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>,
    AddHandlerDataCollectionRecord<
      HandlerContextCollectionHandlerT<C>,
      HandlerT,
      HandlerContextCollectionHData<C>,
      DataOrUndefined<Config>
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<C>,
    const Config extends HandlerContext<HandlerT>,
  >(
    handlerContextCollection: C,
    handlerContextConfig: Config,
  ) =>
    new HandlerContextCollection<
      HandlerContextCollectionHandlerT<C>,
      | HandlerContextCollectionContext<C>
      | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>,
      AddHandlerDataCollectionRecord<
        HandlerContextCollectionHandlerT<C>,
        HandlerT,
        HandlerContextCollectionHData<C>,
        DataOrUndefined<Config>
      >
    >(
      Struct.evolve(
        handlerContextCollection as InferHandlerContextCollection<C>,
        {
          record: (record) =>
            Record.modify(
              record,
              handlerContextCollection.handlerContextTypeTransformer(
                handlerContextConfig,
              ),
              (group) =>
                addHandlerContextGroup(
                  group as unknown as HandlerContextGroup<HandlerT, any, any>,
                  handlerContextConfig,
                ),
            ) as unknown as HandlerContextGroupRecord<
              HandlerContextCollectionHandlerT<C>,
              | HandlerContextCollectionContext<C>
              | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>
            >,
        },
      ),
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
      Struct.evolve(thisCollection as InferHandlerContextCollection<ThisC>, {
        record: (record) =>
          Record.union(
            record,
            (otherCollection as InferHandlerContextCollection<OtherC>).record,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollection<any, any, any>,
    HandlerT extends BaseHandlerT,
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
      Record.get(
        (handlerContextCollection as InferHandlerContextCollection<C>).record,
        type,
      ),
      Option.flatMap(getGroupHandlerContext(key)),
    ) as unknown as Option.Option<
      HandlerContext<
        HandlerT,
        HandlerData<HandlerT>,
        Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
      >
    >,
);
