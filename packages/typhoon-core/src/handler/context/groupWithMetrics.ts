import {
  Data,
  Effect,
  Function,
  Metric,
  Option,
  pipe,
  Types,
  Struct,
  Record,
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
  handler,
  type HandlerContext,
  type HandlerOrUndefined,
  type PartialHandlerContextHandlerT,
} from "./context";
import {
  HandlerContextGroup,
  getHandlerContext,
  add as addHandlerContextGroup,
  addGroup as addGroupHandlerContextGroup,
  type HandlerContextGroupHandlerT,
  type HandlerContextGroupContext,
} from "./group";
import type {
  WithMetricsExecutorContextKind,
  WithMetricsExecutorTypeLambda,
  WithMetricsExecutorResultKind,
} from "./type";

type HandlerContextGroupWithMetricsObject<
  HandlerT extends BaseHandlerT,
  WithMetricsContextT extends WithMetricsExecutorTypeLambda,
  R,
> = {
  group: HandlerContextGroup<HandlerT, R, any>;
  executor: (
    handler: Handler<HandlerT, unknown, unknown, R>,
    context: WithMetricsExecutorContextKind<WithMetricsContextT, R>,
  ) => WithMetricsExecutorResultKind<WithMetricsContextT, R>;
  handlerType: HandlerType<HandlerT>;
  handlerCount: Metric.Metric.Counter<bigint>;
};

const HandlerContextGroupWithMetricsTypeId = Symbol(
  "Typhoon/Handler/HandlerContextGroupWithMetricsTypeId",
);
export type HandlerContextGroupWithMetricsTypeId =
  typeof HandlerContextGroupWithMetricsTypeId;

interface Variance<
  in out HandlerT extends BaseHandlerT,
  in out WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
  out R,
> {
  [HandlerContextGroupWithMetricsTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _WithMetricsExecutorT: Types.Invariant<WithMetricsExecutorT>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextGroupWithMetricsVariance: <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
  R,
>() => Variance<
  HandlerT,
  WithMetricsExecutorT,
  R
>[HandlerContextGroupWithMetricsTypeId] = () => ({
  _HandlerT: Function.identity,
  _WithMetricsExecutorT: Function.identity,
  _R: Function.identity,
});

const HandlerContextGroupWithMetricsTaggedClass = Data.TaggedClass(
  "HandlerContextGroupWithMetrics",
) as unknown as new <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
  R,
>(
  args: Readonly<
    HandlerContextGroupWithMetricsObject<HandlerT, WithMetricsExecutorT, R>
  >,
) => Readonly<
  HandlerContextGroupWithMetricsObject<HandlerT, WithMetricsExecutorT, R>
> & {
  readonly _tag: "HandlerContextGroupWithMetrics";
};

export class HandlerContextGroupWithMetrics<
    HandlerT extends BaseHandlerT,
    WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
    R,
  >
  extends HandlerContextGroupWithMetricsTaggedClass<
    HandlerT,
    WithMetricsExecutorT,
    R
  >
  implements Variance<HandlerT, WithMetricsExecutorT, R>
{
  [HandlerContextGroupWithMetricsTypeId] =
    handlerContextGroupWithMetricsVariance<HandlerT, WithMetricsExecutorT, R>();
}

export type HandlerContextGroupWithMetricsHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroupWithMetrics<any, any, any>,
> = Types.Invariant.Type<G[HandlerContextGroupWithMetricsTypeId]["_HandlerT"]>;
export type HandlerContextGroupWithMetricsWithMetricsExecutorT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroupWithMetrics<any, any, any>,
> = Types.Invariant.Type<
  G[HandlerContextGroupWithMetricsTypeId]["_WithMetricsExecutorT"]
>;
export type HandlerContextGroupWithMetricsContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroupWithMetrics<any, any, any>,
> = Types.Covariant.Type<G[HandlerContextGroupWithMetricsTypeId]["_R"]>;

export const make = <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
  R,
>(
  handlerType: HandlerType<HandlerT>,
  group: HandlerContextGroup<HandlerT, R, any>,
  executor: <MetricsR>(
    handler: Handler<HandlerT, unknown, unknown, R>,
    context: WithMetricsExecutorContextKind<WithMetricsExecutorT, MetricsR>,
  ) => WithMetricsExecutorResultKind<WithMetricsExecutorT, MetricsR>,
): HandlerContextGroupWithMetrics<HandlerT, WithMetricsExecutorT, R> =>
  new HandlerContextGroupWithMetrics<HandlerT, WithMetricsExecutorT, R>({
    group,
    executor,
    handlerType,
    handlerCount: Metric.counter(`typhoon_handler_total`, {
      description: `The number of handler executions`,
      bigint: true,
      incremental: true,
    }),
  });

export const execute = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroupWithMetrics<any, any, any>,
  >(
    key: HandlerDataKey<
      HandlerContextGroupWithMetricsHandlerT<G>,
      HandlerData<HandlerContextGroupWithMetricsHandlerT<G>>
    >,
    metricsContext: WithMetricsExecutorContextKind<
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      HandlerContextGroupWithMetricsContext<G>
    >,
  ) => (
    groupWithMetrics: G,
  ) => Option.Option<
    WithMetricsExecutorResultKind<
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      HandlerContextGroupWithMetricsContext<G>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroupWithMetrics<any, any, any>,
  >(
    groupWithMetrics: G,
    key: HandlerDataKey<
      HandlerContextGroupWithMetricsHandlerT<G>,
      HandlerData<HandlerContextGroupWithMetricsHandlerT<G>>
    >,
    metricsContext: WithMetricsExecutorContextKind<
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      HandlerContextGroupWithMetricsContext<G>
    >,
  ) => Option.Option<
    WithMetricsExecutorResultKind<
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      HandlerContextGroupWithMetricsContext<G>
    >
  >
>(
  3,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroupWithMetrics<any, any, any>,
  >(
    groupWithMetrics: G,
    key: HandlerDataKey<
      HandlerContextGroupWithMetricsHandlerT<G>,
      HandlerData<HandlerContextGroupWithMetricsHandlerT<G>>
    >,
    metricsContext: WithMetricsExecutorContextKind<
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      HandlerContextGroupWithMetricsContext<G>
    >,
  ) =>
    pipe(
      groupWithMetrics.group,
      getHandlerContext(key),
      Option.map((context) =>
        pipe(
          groupWithMetrics.executor(
            handler(context),
            metricsContext,
          ) as WithMetricsExecutorResultKind<
            HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
            HandlerContextGroupWithMetricsContext<G>
          >,
          Effect.tapBoth({
            onSuccess: () =>
              pipe(
                groupWithMetrics.handlerCount,
                Metric.update(BigInt(1)),
                Effect.tagMetrics({
                  handler_type: String(groupWithMetrics.handlerType),
                  handler_key: String(key),
                  handler_status: "success",
                }),
              ),
            onFailure: () =>
              pipe(
                groupWithMetrics.handlerCount,
                Metric.update(BigInt(1)),
                Effect.tagMetrics({
                  handler_type: String(groupWithMetrics.handlerType),
                  handler_key: String(key),
                  handler_status: "failure",
                }),
              ),
          }),
          Effect.withSpan("HandlerContextGroupWithMetrics.execute", {
            captureStackTrace: true,
          }),
        ),
      ),
    ) as Option.Option<
      WithMetricsExecutorResultKind<
        HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
        HandlerContextGroupWithMetricsContext<G>
      >
    >,
);

export const add = Function.dual<
  <const Config extends HandlerContext<any>>(
    handlerContextConfig: Config,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroupWithMetrics<
      PartialHandlerContextHandlerT<Config>,
      any,
      any
    >,
  >(
    groupWithMetrics: G,
  ) => HandlerContextGroupWithMetrics<
    HandlerContextGroupWithMetricsHandlerT<G>,
    HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
    | HandlerContextGroupWithMetricsContext<G>
    | HandlerEffectContext<
        HandlerContextGroupWithMetricsHandlerT<G>,
        HandlerOrUndefined<Config>
      >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroupWithMetrics<any, any, any>,
    const Config extends HandlerContext<
      HandlerContextGroupWithMetricsHandlerT<G>
    >,
  >(
    groupWithMetrics: G,
    handlerContextConfig: Config,
  ) => HandlerContextGroupWithMetrics<
    HandlerContextGroupWithMetricsHandlerT<G>,
    HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
    | HandlerContextGroupWithMetricsContext<G>
    | HandlerEffectContext<
        HandlerContextGroupWithMetricsHandlerT<G>,
        HandlerOrUndefined<Config>
      >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroupWithMetrics<any, any, any>,
    const Config extends HandlerContext<
      HandlerContextGroupWithMetricsHandlerT<G>
    >,
  >(
    groupWithMetrics: G,
    handlerContextConfig: Config,
  ) =>
    new HandlerContextGroupWithMetrics<
      HandlerContextGroupWithMetricsHandlerT<G>,
      HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
      | HandlerContextGroupWithMetricsContext<G>
      | HandlerEffectContext<
          HandlerContextGroupWithMetricsHandlerT<G>,
          HandlerOrUndefined<Config>
        >
    >(
      Struct.evolve(groupWithMetrics, {
        group: addHandlerContextGroup(handlerContextConfig),
      }) as HandlerContextGroupWithMetricsObject<
        HandlerContextGroupWithMetricsHandlerT<G>,
        HandlerContextGroupWithMetricsWithMetricsExecutorT<G>,
        HandlerEffectContext<
          HandlerContextGroupWithMetricsHandlerT<G>,
          HandlerOrUndefined<Config>
        >
      >,
    ),
);

export const addGroup = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<any, any, any>,
  >(
    otherGroup: OtherG,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroupWithMetrics<
      HandlerContextGroupHandlerT<OtherG>,
      any,
      any
    >,
  >(
    thisGroupWithMetrics: ThisG,
  ) => HandlerContextGroupWithMetrics<
    HandlerContextGroupWithMetricsHandlerT<ThisG>,
    HandlerContextGroupWithMetricsWithMetricsExecutorT<ThisG>,
    | HandlerContextGroupWithMetricsContext<ThisG>
    | HandlerContextGroupContext<OtherG>
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroupWithMetrics<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<
      HandlerContextGroupWithMetricsHandlerT<ThisG>,
      any,
      any
    >,
  >(
    thisGroupWithMetrics: ThisG,
    otherGroup: OtherG,
  ) => HandlerContextGroupWithMetrics<
    HandlerContextGroupWithMetricsHandlerT<ThisG>,
    HandlerContextGroupWithMetricsWithMetricsExecutorT<ThisG>,
    | HandlerContextGroupWithMetricsContext<ThisG>
    | HandlerContextGroupContext<OtherG>
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroupWithMetrics<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<
      HandlerContextGroupWithMetricsHandlerT<ThisG>,
      any,
      any
    >,
  >(
    thisGroupWithMetrics: ThisG,
    otherGroup: OtherG,
  ) =>
    new HandlerContextGroupWithMetrics<
      HandlerContextGroupWithMetricsHandlerT<ThisG>,
      HandlerContextGroupWithMetricsWithMetricsExecutorT<ThisG>,
      | HandlerContextGroupWithMetricsContext<ThisG>
      | HandlerContextGroupContext<OtherG>
    >(
      Struct.evolve(thisGroupWithMetrics, {
        group: addGroupHandlerContextGroup(otherGroup),
      }) as HandlerContextGroupWithMetricsObject<
        HandlerContextGroupWithMetricsHandlerT<ThisG>,
        HandlerContextGroupWithMetricsWithMetricsExecutorT<ThisG>,
        | HandlerContextGroupWithMetricsContext<ThisG>
        | HandlerContextGroupContext<OtherG>
      >,
    ),
);

export const initialize = <
  HandlerT extends BaseHandlerT,
  WithMetricsExecutorT extends WithMetricsExecutorTypeLambda,
  R,
>(
  groupWithMetrics: HandlerContextGroupWithMetrics<
    HandlerT,
    WithMetricsExecutorT,
    R
  >,
): Effect.Effect<void, never, never> =>
  pipe(
    Record.keys(groupWithMetrics.group.record),
    Effect.forEach((handlerKey) =>
      pipe(
        ["success", "failure"],
        Effect.forEach((handlerStatus) =>
          pipe(
            groupWithMetrics.handlerCount,
            Metric.update(BigInt(0)),
            Effect.tagMetrics({
              handler_type: String(groupWithMetrics.handlerType),
              handler_key: String(handlerKey),
              handler_status: handlerStatus,
            }),
          ),
        ),
      ),
    ),
    Effect.asVoid,
    Effect.withSpan("HandlerContextGroupWithMetrics.initialize", {
      captureStackTrace: true,
    }),
  );
