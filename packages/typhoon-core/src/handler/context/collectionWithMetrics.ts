import { Data, Effect, Option, pipe, Struct } from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerContext as HandlerEffectContext,
  HandlerData,
  HandlerDataKey,
  HandlerType,
  HandlerSuccess,
  HandlerError,
} from "../type";
import {
  HandlerContextCollection,
  empty as emptyHandlerContextCollection,
  add as addHandlerContextCollection,
  addCollection as addCollectionHandlerContextCollection,
  type HandlerContextCollectionContext,
  type HandlerContextCollectionHandlerT,
} from "./collection";
import {
  type HandlerContextGroupWithMetrics as HandlerContextGroupWithMetricsType,
  make as makeHandlerContextGroupWithMetrics,
  execute as executeHandlerContextGroupWithMetrics,
  initialize as initializeHandlerContextGroupWithMetrics,
} from "./groupWithMetrics";
import { HandlerContextGroup } from "./group";
import type {
  HandlerContext,
  HandlerOrUndefined,
  PartialHandlerContextHandlerT,
} from "./context";

type HandlerContextGroupWithMetricsStruct<
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
  handlerContext: HandlerT extends HandlerT
    ? HandlerContext<HandlerT, HandlerData<HandlerT>, Handler<HandlerT>>
    : never,
) => HandlerType<HandlerT>;

type HandlerContextCollectionWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  collection: HandlerContextCollection<HandlerT, R>;
  struct: HandlerContextGroupWithMetricsStruct<HandlerT, R>;
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
};

export class HandlerContextCollectionWithMetrics<
  HandlerT extends BaseHandlerT,
  R = never,
> extends Data.TaggedClass("HandlerContextCollectionWithMetrics")<
  HandlerContextCollectionWithMetricsObject<HandlerT, R>
> {}

export const make = <HandlerT extends BaseHandlerT, R = never>(
  _dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
  collection: HandlerContextCollection<HandlerT, R>,
): HandlerContextCollectionWithMetrics<HandlerT, R> =>
  new HandlerContextCollectionWithMetrics({
    collection,
    struct: Object.fromEntries(
      Object.entries(collection.struct).map(([type, group]) => [
        type,
        makeHandlerContextGroupWithMetrics(
          type as HandlerType<HandlerT>,
          group as HandlerContextGroup<HandlerT, R>,
        ),
      ]),
    ) as unknown as HandlerContextGroupWithMetricsStruct<HandlerT, R>,
    handlerContextTypeTransformer,
  });

export const empty = <HandlerT extends BaseHandlerT>(
  dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
): HandlerContextCollectionWithMetrics<HandlerT, never> =>
  make(
    dataKeyTransformers,
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
    CollectionHandlerT extends HandlerContextCollectionHandlerT<
      C["collection"]
    > = HandlerContextCollectionHandlerT<C["collection"]>,
  >(
    collectionWithMetrics: C,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ?
            | HandlerContextCollectionContext<C["collection"]>
            | HandlerEffectContext<HandlerT, H>
        : never
    >(
      (() => {
        const updatedCollection = addHandlerContextCollection(
          handlerContextConfig,
        )(collectionWithMetrics.collection);
        const handlerType =
          collectionWithMetrics.handlerContextTypeTransformer(
            handlerContextConfig,
          );
        return new HandlerContextCollectionWithMetrics<
          HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
          HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
            ?
                | HandlerContextCollectionContext<C["collection"]>
                | HandlerEffectContext<HandlerT, H>
            : never
        >({
          collection: updatedCollection,
          struct: Struct.evolve(collectionWithMetrics.struct, {
            [handlerType]: (
              _groupWithMetrics: HandlerContextGroupWithMetricsType<
                HandlerT,
                HandlerContextCollectionContext<C["collection"]>
              >,
            ) => {
              const group = updatedCollection.struct[
                handlerType as HandlerType<HandlerT>
              ] as HandlerContextGroup<
                HandlerT,
                HandlerContextCollectionContext<C["collection"]>
              >;
              return makeHandlerContextGroupWithMetrics(
                handlerType as HandlerType<HandlerT>,
                group,
              );
            },
          }) as unknown as HandlerContextGroupWithMetricsStruct<
            CollectionHandlerT,
            HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
              ?
                  | HandlerContextCollectionContext<C["collection"]>
                  | HandlerEffectContext<HandlerT, H>
              : never
          >,
          handlerContextTypeTransformer:
            collectionWithMetrics.handlerContextTypeTransformer,
        });
      })(),
    );

export const addCollection =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollectionWithMetrics<any, any>,
    HandlerT extends HandlerContextCollectionHandlerT<
      OtherC["collection"]
    > = HandlerContextCollectionHandlerT<OtherC["collection"]>,
  >(
    otherCollectionWithMetrics: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisC extends HandlerContextCollectionWithMetrics<HandlerT, any>>(
    thisCollectionWithMetrics: ThisC,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT,
      | HandlerContextCollectionContext<ThisC["collection"]>
      | HandlerContextCollectionContext<OtherC["collection"]>
    >(
      Struct.evolve(thisCollectionWithMetrics, {
        collection: (collection) =>
          addCollectionHandlerContextCollection(
            otherCollectionWithMetrics.collection,
          )(collection),
        struct: (struct) =>
          Object.fromEntries(
            Object.entries(struct).map(([type, _groupWithMetrics]) => [
              type,
              makeHandlerContextGroupWithMetrics(
                type as HandlerType<HandlerT>,
                addCollectionHandlerContextCollection(
                  otherCollectionWithMetrics.collection,
                )(thisCollectionWithMetrics.collection).struct[type],
              ),
            ]),
          ) as HandlerContextGroupWithMetricsStruct<
            HandlerT,
            | HandlerContextCollectionContext<ThisC["collection"]>
            | HandlerContextCollectionContext<OtherC["collection"]>
          >,
      }),
    );

export const execute =
  <HandlerT extends BaseHandlerT>(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  <R>(
    collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, R>,
  ): Option.Option<
    Effect.Effect<
      HandlerSuccess<HandlerT, Handler<HandlerT, unknown, unknown, R>>,
      HandlerError<HandlerT, Handler<HandlerT, unknown, unknown, R>>,
      R
    >
  > =>
    pipe(
      collectionWithMetrics.struct[type] as HandlerContextGroupWithMetricsType<
        HandlerT,
        R
      >,
      executeHandlerContextGroupWithMetrics(key),
    );

export const initialize = (
  collectionWithMetrics: HandlerContextCollectionWithMetrics<
    BaseHandlerT,
    unknown
  >,
): Effect.Effect<void, never, never> =>
  pipe(
    Object.values(collectionWithMetrics.struct) as Array<
      HandlerContextGroupWithMetricsType<BaseHandlerT, unknown>
    >,
    Effect.forEach((groupWithMetrics) =>
      initializeHandlerContextGroupWithMetrics(groupWithMetrics),
    ),
    Effect.asVoid,
    Effect.withSpan("HandlerContextCollectionWithMetrics.initialize", {
      captureStackTrace: true,
    }),
  );
