import { Data, Effect, Either, Option, pipe } from "effect";
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
> extends HandlerContextCollectionWithMetricsTaggedClass<HandlerT, R> {}

export const make = <HandlerT extends BaseHandlerT, R = never>(
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
  ) => {
    const updatedCollection = addHandlerContextCollection(handlerContextConfig)(
      collectionWithMetrics.collection,
    );
    const handlerType =
      collectionWithMetrics.handlerContextTypeTransformer(handlerContextConfig);
    return new HandlerContextCollectionWithMetrics<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ?
            | HandlerContextCollectionContext<C["collection"]>
            | HandlerEffectContext<HandlerT, H>
        : never
    >({
      collection: updatedCollection,
      struct: {
        ...collectionWithMetrics.struct,
        [handlerType]: makeHandlerContextGroupWithMetrics(
          handlerType as HandlerType<HandlerT>,
          updatedCollection.struct[
            handlerType as HandlerType<HandlerT>
          ] as HandlerContextGroup<
            HandlerT,
            HandlerContextCollectionContext<C["collection"]>
          >,
        ),
      } as unknown as HandlerContextGroupWithMetricsStruct<
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
  };

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
  ) => {
    const updatedCollection = addCollectionHandlerContextCollection(
      otherCollectionWithMetrics.collection,
    )(thisCollectionWithMetrics.collection);
    return new HandlerContextCollectionWithMetrics<
      HandlerT,
      | HandlerContextCollectionContext<ThisC["collection"]>
      | HandlerContextCollectionContext<OtherC["collection"]>
    >({
      collection: updatedCollection,
      struct: Object.fromEntries(
        Object.keys(updatedCollection.struct).map((type) => [
          type,
          makeHandlerContextGroupWithMetrics(
            type as HandlerType<HandlerT>,
            updatedCollection.struct[type] as HandlerContextGroup<
              HandlerT,
              | HandlerContextCollectionContext<ThisC["collection"]>
              | HandlerContextCollectionContext<OtherC["collection"]>
            >,
          ),
        ]),
      ) as unknown as HandlerContextGroupWithMetricsStruct<
        HandlerT,
        | HandlerContextCollectionContext<ThisC["collection"]>
        | HandlerContextCollectionContext<OtherC["collection"]>
      >,
      handlerContextTypeTransformer:
        thisCollectionWithMetrics.handlerContextTypeTransformer,
    });
  };

export const execute =
  <HandlerT extends BaseHandlerT>(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  <R>(
    collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, R>,
  ): Effect.Effect<
    Option.Option<
      Either.Either<
        HandlerError<HandlerT, Handler<HandlerT, unknown, unknown, R>>,
        HandlerSuccess<HandlerT, Handler<HandlerT, unknown, unknown, R>>
      >
    >,
    never,
    R
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
