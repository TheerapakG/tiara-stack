import {
  Data,
  Effect,
  Either,
  Function,
  Option,
  pipe,
  Struct,
  Types,
} from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataKey,
  HandlerType,
  HandlerSuccess,
  HandlerError,
  HandlerContext as HandlerEffectContext,
} from "../type";
import {
  HandlerContextCollection,
  empty as emptyHandlerContextCollection,
  type HandlerContextCollectionHandlerT,
  type HandlerContextCollectionContext,
} from "./collection";
import {
  HandlerContextGroupWithMetrics,
  type HandlerContextGroupWithMetrics as HandlerContextGroupWithMetricsType,
  make as makeHandlerContextGroupWithMetrics,
  execute as executeHandlerContextGroupWithMetrics,
  initialize as initializeHandlerContextGroupWithMetrics,
} from "./groupWithMetrics";
import {
  HandlerContextGroup,
  add as addHandlerContextGroup,
  addGroup as addGroupHandlerContextGroup,
} from "./group";
import type {
  HandlerContext,
  PartialHandlerContextHandlerT,
  HandlerOrUndefined,
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
  struct: HandlerContextGroupWithMetricsStruct<HandlerT, R>;
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
  collection: HandlerContextCollection<HandlerT, R>,
): HandlerContextCollectionWithMetrics<HandlerT, R> =>
  new HandlerContextCollectionWithMetrics({
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
    CollectionHandlerT extends
      HandlerContextCollectionWithMetricsHandlerT<C> = HandlerContextCollectionWithMetricsHandlerT<C>,
  >(
    collectionWithMetrics: C,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ?
            | HandlerContextCollectionWithMetricsContext<C>
            | HandlerEffectContext<HandlerT, H>
        : never
    >(
      Struct.evolve(collectionWithMetrics, {
        struct: (struct) =>
          Struct.evolve(struct, {
            [collectionWithMetrics.handlerContextTypeTransformer(
              handlerContextConfig,
            )]: (
              groupWithMetrics: HandlerContextGroupWithMetricsType<
                HandlerT,
                HandlerContextCollectionWithMetricsContext<C>
              >,
            ) =>
              new HandlerContextGroupWithMetrics({
                ...groupWithMetrics,
                group: addHandlerContextGroup(handlerContextConfig)(
                  groupWithMetrics.group,
                ),
              }),
          }) as unknown as HandlerContextGroupWithMetricsStruct<
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
    const OtherC extends HandlerContextCollection<any, any>,
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
        struct: (struct) =>
          Object.fromEntries(
            Object.entries(struct).map(([type, groupWithMetrics]) => [
              type,
              new HandlerContextGroupWithMetrics({
                ...(groupWithMetrics as HandlerContextGroupWithMetricsType<
                  HandlerT,
                  HandlerContextCollectionWithMetricsContext<ThisC>
                >),
                group: addGroupHandlerContextGroup(
                  otherCollection.struct[type] as HandlerContextGroup<
                    HandlerT,
                    HandlerContextCollectionContext<OtherC>
                  >,
                )(
                  (
                    groupWithMetrics as HandlerContextGroupWithMetricsType<
                      HandlerT,
                      HandlerContextCollectionWithMetricsContext<ThisC>
                    >
                  ).group,
                ),
              }),
            ]),
          ) as unknown as HandlerContextGroupWithMetricsStruct<
            HandlerT,
            | HandlerContextCollectionWithMetricsContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
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
