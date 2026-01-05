import {
  Data,
  Effect,
  Either,
  Function,
  Option,
  pipe,
  Record,
  Struct,
  Types,
  Array,
} from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataKey,
  HandlerType,
  HandlerContext as HandlerEffectContext,
  HandlerDefaultContext,
} from "../type";
import {
  HandlerContextCollection,
  empty as emptyHandlerContextCollection,
  type HandlerContextCollectionHandlerT,
  type HandlerContextCollectionContext,
} from "./collection";
import {
  type HandlerContextGroupWithMetrics as HandlerContextGroupWithMetricsType,
  make as makeHandlerContextGroupWithMetrics,
  execute as executeHandlerContextGroupWithMetrics,
  initialize as initializeHandlerContextGroupWithMetrics,
  add as addHandlerContextGroupWithMetrics,
  addGroup as addGroupHandlerContextGroupWithMetrics,
} from "./groupWithMetrics";
import type {
  HandlerContext,
  PartialHandlerContextHandlerT,
  HandlerOrUndefined,
} from "./context";

type HandlerContextGroupWithMetricsRecord<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerContextGroupWithMetricsType<
    HT,
    R
  >;
};

type HandlerDataKeyTransformerStruct<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: (
    data: HandlerData<HT>,
  ) => HandlerDataKey<HT, HandlerData<HT>>;
};

type HandlerContextTypeTransformer<HandlerT extends BaseHandlerT> = (
  handlerContext: HandlerT extends infer HT extends BaseHandlerT
    ? HandlerContext<HT, HandlerData<HT>, Handler<HT>>
    : never,
) => HandlerType<HandlerT>;

type HandlerContextCollectionWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  record: HandlerContextGroupWithMetricsRecord<HandlerT, R>;
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
};

const HandlerContextCollectionWithMetricsTypeId = Symbol(
  "Typhoon/Handler/HandlerContextCollectionWithMetricsTypeId",
);
export type HandlerContextCollectionWithMetricsTypeId =
  typeof HandlerContextCollectionWithMetricsTypeId;

interface Variance<in out HandlerT extends BaseHandlerT, out R> {
  [HandlerContextCollectionWithMetricsTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextCollectionWithMetricsVariance: <
  HandlerT extends BaseHandlerT,
  R,
>() => Variance<
  HandlerT,
  R
>[HandlerContextCollectionWithMetricsTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
});

const HandlerContextCollectionWithMetricsTaggedClass = Data.TaggedClass(
  "HandlerContextCollectionWithMetrics",
) as unknown as new <HandlerT extends BaseHandlerT, R = never>(
  args: Readonly<HandlerContextCollectionWithMetricsObject<HandlerT, R>>,
) => Readonly<HandlerContextCollectionWithMetricsObject<HandlerT, R>> & {
  readonly _tag: "HandlerContextCollectionWithMetrics";
};

export class HandlerContextCollectionWithMetrics<
    HandlerT extends BaseHandlerT,
    R = never,
  >
  extends HandlerContextCollectionWithMetricsTaggedClass<HandlerT, R>
  implements Variance<HandlerT, R>
{
  [HandlerContextCollectionWithMetricsTypeId] =
    handlerContextCollectionWithMetricsVariance<HandlerT, R>();
}

export type HandlerContextCollectionWithMetricsHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any>,
> = Types.Invariant.Type<
  C[HandlerContextCollectionWithMetricsTypeId]["_HandlerT"]
>;
export type HandlerContextCollectionWithMetricsContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any>,
> = Types.Covariant.Type<C[HandlerContextCollectionWithMetricsTypeId]["_R"]>;

export const make = <HandlerT extends BaseHandlerT, R = never>(
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: HandlerContextCollection<HandlerT, R, any>,
): HandlerContextCollectionWithMetrics<HandlerT, R> =>
  new HandlerContextCollectionWithMetrics({
    record: Record.mapEntries(collection.record, (group, type) => [
      type,
      makeHandlerContextGroupWithMetrics(type, group),
    ]) as unknown as HandlerContextGroupWithMetricsRecord<HandlerT, R>,
    handlerContextTypeTransformer,
  });

export const empty = <HandlerT extends BaseHandlerT>(
  dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
): HandlerContextCollectionWithMetrics<HandlerT, never> =>
  make(
    handlerContextTypeTransformer,
    emptyHandlerContextCollection(
      dataKeyTransformers,
      handlerContextTypeTransformer,
    ),
  );

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
    const C extends HandlerContextCollectionWithMetrics<any, any>,
    CollectionHandlerT extends
      HandlerContextCollectionWithMetricsHandlerT<C> = HandlerContextCollectionWithMetricsHandlerT<C>,
  >(
    collectionWithMetrics: C,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      | HandlerContextCollectionWithMetricsContext<C>
      | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>
    >(
      Struct.evolve(collectionWithMetrics, {
        record: (record) =>
          Record.modify(
            record,
            collectionWithMetrics.handlerContextTypeTransformer(
              handlerContextConfig,
            ) as HandlerType<HandlerT>,
            (groupWithMetrics) =>
              pipe(
                groupWithMetrics,
                addHandlerContextGroupWithMetrics(handlerContextConfig),
              ),
          ) as HandlerContextGroupWithMetricsRecord<
            CollectionHandlerT,
            HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
              ?
                  | HandlerContextCollectionWithMetricsContext<C>
                  | HandlerEffectContext<HandlerT, H>
              : never
          >,
      }),
    );

export const addCollection =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any, any>,
    HandlerT extends
      HandlerContextCollectionHandlerT<OtherC> = HandlerContextCollectionHandlerT<OtherC>,
  >(
    otherCollection: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisC extends HandlerContextCollectionWithMetrics<HandlerT, any>>(
    thisCollectionWithMetrics: ThisC,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT,
      | HandlerContextCollectionWithMetricsContext<ThisC>
      | HandlerContextCollectionContext<OtherC>
    >(
      Struct.evolve(thisCollectionWithMetrics, {
        record: (record) =>
          Record.mapEntries(record, (groupWithMetrics, type) => [
            type,
            addGroupHandlerContextGroupWithMetrics(
              otherCollection.record[type],
            )(groupWithMetrics),
          ]) as unknown as HandlerContextGroupWithMetricsRecord<
            HandlerT,
            | HandlerContextCollectionWithMetricsContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
          >,
      }),
    );

export const execute =
  <
    CollectionHandlerT extends BaseHandlerT,
    HandlerT extends CollectionHandlerT,
  >(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  <
    R,
    HandlerEffect extends Handler<
      HandlerT,
      unknown,
      unknown,
      R
    > extends infer E extends Effect.Effect<unknown, unknown, unknown>
      ? E
      : never = Handler<HandlerT, unknown, unknown, R> extends infer E extends
      Effect.Effect<unknown, unknown, unknown>
      ? E
      : never,
  >(
    collectionWithMetrics: HandlerContextCollectionWithMetrics<
      CollectionHandlerT,
      R
    >,
  ): Effect.Effect<
    Option.Option<
      Either.Either<
        Effect.Effect.Success<HandlerEffect>,
        Effect.Effect.Error<HandlerEffect>
      >
    >,
    never,
    R | HandlerDefaultContext<HandlerT>
  > =>
    pipe(
      collectionWithMetrics.record[type] as HandlerContextGroupWithMetricsType<
        HandlerT,
        R
      >,
      executeHandlerContextGroupWithMetrics(key),
    );

export const initialize = <HandlerT extends BaseHandlerT, R = never>(
  collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, R>,
): Effect.Effect<void, never, never> =>
  pipe(
    Object.values(collectionWithMetrics.record) as Array<
      HandlerContextGroupWithMetricsType<HandlerT, R>
    >,
    Effect.forEach((groupWithMetrics) =>
      initializeHandlerContextGroupWithMetrics(groupWithMetrics),
    ),
    Effect.asVoid,
    Effect.withSpan("HandlerContextCollectionWithMetrics.initialize", {
      captureStackTrace: true,
    }),
  );
