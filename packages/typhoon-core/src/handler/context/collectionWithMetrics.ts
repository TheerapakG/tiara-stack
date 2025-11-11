import { Data, Effect, HashMap, Metric, pipe, Struct } from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerContext as HandlerEffectContext,
  HandlerData,
  HandlerDataKey,
  HandlerType,
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
  HandlerContextGroupWithMetrics,
  type HandlerContextGroupWithMetrics as HandlerContextGroupWithMetricsType,
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

export class HandlerContextCollectionWithMetrics<
  HandlerT extends BaseHandlerT,
  R = never,
> extends Data.TaggedClass("HandlerContextCollectionWithMetrics")<{
  collection: HandlerContextCollection<HandlerT, R>;
  struct: HandlerContextGroupWithMetricsStruct<HandlerT, R>;
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
}> {
  static make = <HandlerT extends BaseHandlerT, R = never>(
    _dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
    handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
    collection: HandlerContextCollection<HandlerT, R>,
  ): HandlerContextCollectionWithMetrics<HandlerT, R> =>
    new HandlerContextCollectionWithMetrics({
      collection,
      struct: Object.fromEntries(
        Object.entries(collection.struct).map(([type, group]) => [
          type,
          HandlerContextGroupWithMetrics.make(
            type,
            group as HandlerContextGroup<HandlerT, R>,
          ),
        ]),
      ) as unknown as HandlerContextGroupWithMetricsStruct<HandlerT, R>,
      handlerContextTypeTransformer,
    });

  static empty = <HandlerT extends BaseHandlerT>(
    dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
    handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
  ): HandlerContextCollectionWithMetrics<HandlerT, never> =>
    HandlerContextCollectionWithMetrics.make(
      dataKeyTransformers,
      handlerContextTypeTransformer,
      emptyHandlerContextCollection(
        dataKeyTransformers,
        handlerContextTypeTransformer,
      ),
    );

  static add =
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
                return HandlerContextGroupWithMetrics.make(handlerType, group);
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

  static addCollection =
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
                HandlerContextGroupWithMetrics.make(
                  type,
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

  static execute =
    <HandlerT extends BaseHandlerT>(
      type: HandlerType<HandlerT>,
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
    ) =>
    <R>(
      collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, R>,
    ): Effect.Effect<void, unknown, R> =>
      pipe(
        collectionWithMetrics.struct[
          type
        ] as HandlerContextGroupWithMetricsType<HandlerT, R>,
        HandlerContextGroupWithMetrics.execute(key),
        Effect.withSpan("HandlerContextCollectionWithMetrics.execute", {
          captureStackTrace: true,
        }),
      );

  static executeAndReplyError =
    <HandlerT extends BaseHandlerT>(
      type: HandlerType<HandlerT>,
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
    ) =>
    <R>(
      collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, R>,
    ): Effect.Effect<void, unknown, R> =>
      pipe(
        collectionWithMetrics.struct[
          type
        ] as HandlerContextGroupWithMetricsType<HandlerT, R>,
        HandlerContextGroupWithMetrics.executeAndReplyError(key),
        Effect.withSpan(
          "HandlerContextCollectionWithMetrics.executeAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );

  static initialize = (
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
        pipe(
          HashMap.keys(groupWithMetrics.group.map),
          Effect.forEach((handlerKey) =>
            pipe(
              ["success", "failure"],
              Effect.forEach((handlerStatus) =>
                pipe(
                  groupWithMetrics.handlerCount,
                  Metric.update(BigInt(0)),
                  Effect.tagMetrics({
                    handler_type: groupWithMetrics.handlerType,
                    handler_key: String(handlerKey),
                    handler_status: handlerStatus,
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("HandlerContextCollectionWithMetrics.initialize", {
        captureStackTrace: true,
      }),
    );
}
