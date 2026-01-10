import {
  Data,
  Effect,
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
import type { HandlerContextGroup } from "./group";
import type {
  WithMetricsExecutorContextKind,
  WithMetricsExecutorTypeLambda,
  WithMetricsExecutorResultKind,
} from "./type";

type HandlerWithMetricsExecutorTRecord<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: WithMetricsExecutorTypeLambda;
};

type HandlerContextGroupWithMetricsRecord<
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R = never,
> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerContextGroupWithMetricsType<
    HT,
    HT extends keyof WithMetricsExecutorTRecord
      ? WithMetricsExecutorTRecord[HT] extends infer W extends
          WithMetricsExecutorTypeLambda
        ? W
        : never
      : never,
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
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R = never,
> = {
  record: HandlerContextGroupWithMetricsRecord<
    HandlerT,
    WithMetricsExecutorTRecord,
    R
  >;
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
};

const HandlerContextCollectionWithMetricsTypeId = Symbol(
  "Typhoon/Handler/HandlerContextCollectionWithMetricsTypeId",
);
export type HandlerContextCollectionWithMetricsTypeId =
  typeof HandlerContextCollectionWithMetricsTypeId;

interface Variance<
  in out HandlerT extends BaseHandlerT,
  in out WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  out R,
> {
  [HandlerContextCollectionWithMetricsTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _WithMetricsExecutorTRecord: Types.Invariant<WithMetricsExecutorTRecord>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextCollectionWithMetricsVariance: <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R,
>() => Variance<
  HandlerT,
  WithMetricsExecutorTRecord,
  R
>[HandlerContextCollectionWithMetricsTypeId] = () => ({
  _HandlerT: Function.identity,
  _WithMetricsExecutorTRecord: Function.identity,
  _R: Function.identity,
});

const HandlerContextCollectionWithMetricsTaggedClass = Data.TaggedClass(
  "HandlerContextCollectionWithMetrics",
) as unknown as new <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R = never,
>(
  args: Readonly<
    HandlerContextCollectionWithMetricsObject<
      HandlerT,
      WithMetricsExecutorTRecord,
      R
    >
  >,
) => Readonly<
  HandlerContextCollectionWithMetricsObject<
    HandlerT,
    WithMetricsExecutorTRecord,
    R
  >
> & {
  readonly _tag: "HandlerContextCollectionWithMetrics";
};

export class HandlerContextCollectionWithMetrics<
    HandlerT extends BaseHandlerT,
    WithMetricsExecutorTRecord extends
      HandlerWithMetricsExecutorTRecord<HandlerT>,
    R = never,
  >
  extends HandlerContextCollectionWithMetricsTaggedClass<
    HandlerT,
    WithMetricsExecutorTRecord,
    R
  >
  implements Variance<HandlerT, WithMetricsExecutorTRecord, R>
{
  [HandlerContextCollectionWithMetricsTypeId] =
    handlerContextCollectionWithMetricsVariance<
      HandlerT,
      WithMetricsExecutorTRecord,
      R
    >();
}

export type HandlerContextCollectionWithMetricsHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any, any>,
> = Types.Invariant.Type<
  C[HandlerContextCollectionWithMetricsTypeId]["_HandlerT"]
>;
export type HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any, any>,
> = Types.Invariant.Type<
  C[HandlerContextCollectionWithMetricsTypeId]["_WithMetricsExecutorTRecord"]
>;
export type HandlerContextCollectionWithMetricsContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any, any>,
> = Types.Covariant.Type<C[HandlerContextCollectionWithMetricsTypeId]["_R"]>;
export type HandlerContextCollectionWithMetricsWithMetricsExecutorT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollectionWithMetrics<any, any, any>,
  HandlerT extends BaseHandlerT,
> = HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<C>[HandlerType<HandlerT>] extends infer W extends
  WithMetricsExecutorTypeLambda
  ? W
  : never;

export const make = <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R = never,
>(
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: HandlerContextCollection<HandlerT, R, any>,
  executors: {
    [HT in HandlerT as HandlerType<HT>]: <MetricsR>(
      handler: Handler<HT, unknown, unknown, R>,
      context: WithMetricsExecutorContextKind<
        HandlerType<HT> extends keyof WithMetricsExecutorTRecord
          ? WithMetricsExecutorTRecord[HandlerType<HT>] extends infer W extends
              WithMetricsExecutorTypeLambda
            ? W
            : never
          : never,
        MetricsR
      >,
    ) => WithMetricsExecutorResultKind<
      HandlerType<HT> extends keyof WithMetricsExecutorTRecord
        ? WithMetricsExecutorTRecord[HandlerType<HT>] extends infer W extends
            WithMetricsExecutorTypeLambda
          ? W
          : never
        : never,
      MetricsR
    >;
  },
): HandlerContextCollectionWithMetrics<
  HandlerT,
  WithMetricsExecutorTRecord,
  R
> =>
  new HandlerContextCollectionWithMetrics({
    record: Record.map(collection.record, (group, type) =>
      makeHandlerContextGroupWithMetrics(
        type as HandlerType<HandlerT>,
        group as unknown as HandlerContextGroup<HandlerT, R, any>,
        executors[type as HandlerType<HandlerT>] as (
          handler: Handler<HandlerT, unknown, unknown, R>,
          context: WithMetricsExecutorContextKind<
            HandlerType<HandlerT> extends keyof WithMetricsExecutorTRecord
              ? WithMetricsExecutorTRecord[HandlerType<HandlerT>] extends infer W extends
                  WithMetricsExecutorTypeLambda
                ? W
                : never
              : never,
            R
          >,
        ) => WithMetricsExecutorResultKind<
          HandlerType<HandlerT> extends keyof WithMetricsExecutorTRecord
            ? WithMetricsExecutorTRecord[HandlerType<HandlerT>] extends infer W extends
                WithMetricsExecutorTypeLambda
              ? W
              : never
            : never,
          R
        >,
      ),
    ) as unknown as HandlerContextGroupWithMetricsRecord<
      HandlerT,
      WithMetricsExecutorTRecord,
      R
    >,
    handlerContextTypeTransformer,
  });

export const empty = <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorTRecord extends
    HandlerWithMetricsExecutorTRecord<HandlerT>,
  R = never,
>(
  dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
  executors: {
    [HT in HandlerT as HandlerType<HT>]: (
      handler: Handler<HT, unknown, unknown, R>,
      context: WithMetricsExecutorContextKind<
        HandlerType<HT> extends keyof WithMetricsExecutorTRecord
          ? WithMetricsExecutorTRecord[HandlerType<HT>] extends infer W extends
              WithMetricsExecutorTypeLambda
            ? W
            : never
          : never,
        R
      >,
    ) => WithMetricsExecutorResultKind<
      HandlerType<HT> extends keyof WithMetricsExecutorTRecord
        ? WithMetricsExecutorTRecord[HandlerType<HT>] extends infer W extends
            WithMetricsExecutorTypeLambda
          ? W
          : never
        : never,
      R
    >;
  },
): HandlerContextCollectionWithMetrics<
  HandlerT,
  WithMetricsExecutorTRecord,
  R
> =>
  make(
    handlerContextTypeTransformer,
    emptyHandlerContextCollection(
      dataKeyTransformers,
      handlerContextTypeTransformer,
    ),
    executors,
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
    const C extends HandlerContextCollectionWithMetrics<any, any, any>,
    CollectionHandlerT extends
      HandlerContextCollectionWithMetricsHandlerT<C> = HandlerContextCollectionWithMetricsHandlerT<C>,
    WithMetricsExecutorTRecord extends
      HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<C> = HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<C>,
  >(
    collectionWithMetrics: C,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      WithMetricsExecutorTRecord,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ?
            | HandlerContextCollectionWithMetricsContext<C>
            | HandlerEffectContext<HandlerT, H>
        : never
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
          ) as unknown as HandlerContextGroupWithMetricsRecord<
            CollectionHandlerT,
            WithMetricsExecutorTRecord,
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
  <
    const ThisC extends HandlerContextCollectionWithMetrics<HandlerT, any, any>,
    WithMetricsExecutorTRecord extends
      HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<ThisC> = HandlerContextCollectionWithMetricsWithMetricsExecutorTRecord<ThisC>,
  >(
    thisCollectionWithMetrics: ThisC,
  ) =>
    new HandlerContextCollectionWithMetrics<
      HandlerT,
      WithMetricsExecutorTRecord,
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
            WithMetricsExecutorTRecord,
            | HandlerContextCollectionWithMetricsContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
          >,
      }),
    );

export const execute =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C extends HandlerContextCollectionWithMetrics<any, any, any>,
    HandlerT extends HandlerContextCollectionWithMetricsHandlerT<C>,
    WithMetricsExecutorT extends
      HandlerContextCollectionWithMetricsWithMetricsExecutorT<
        C,
        HandlerT
      > = HandlerContextCollectionWithMetricsWithMetricsExecutorT<C, HandlerT>,
    R extends
      HandlerContextCollectionWithMetricsContext<C> = HandlerContextCollectionWithMetricsContext<C>,
  >(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
    metricsContext: WithMetricsExecutorContextKind<WithMetricsExecutorT, R>,
  ) =>
  (
    collectionWithMetrics: C,
  ): Option.Option<WithMetricsExecutorResultKind<WithMetricsExecutorT, R>> =>
    pipe(
      Record.get(collectionWithMetrics.record, type) as Option.Option<
        HandlerContextGroupWithMetricsType<HandlerT, WithMetricsExecutorT, R>
      >,
      Option.flatMap(
        executeHandlerContextGroupWithMetrics(key, metricsContext),
      ),
    );

export const initialize = <HandlerT extends BaseHandlerT, R = never>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectionWithMetrics: HandlerContextCollectionWithMetrics<HandlerT, any, R>,
): Effect.Effect<void, never, never> =>
  pipe(
    Object.values(collectionWithMetrics.record) as Array<
      HandlerContextGroupWithMetricsType<HandlerT, any, R>
    >,
    Effect.forEach((groupWithMetrics) =>
      initializeHandlerContextGroupWithMetrics(groupWithMetrics),
    ),
    Effect.asVoid,
    Effect.withSpan("HandlerContextCollectionWithMetrics.initialize", {
      captureStackTrace: true,
    }),
  );
