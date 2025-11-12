import {
  Data,
  Effect,
  Either,
  Function,
  HashMap,
  Metric,
  Option,
  pipe,
  Types,
  Struct,
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

type HandlerContextGroupWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  group: HandlerContextGroup<HandlerT, R>;
  handlerType: HandlerType<HandlerT>;
  handlerCount: Metric.Metric.Counter<bigint>;
};

const HandlerContextGroupWithMetricsTypeId = Symbol(
  "Typhoon/Handler/HandlerContextGroupWithMetricsTypeId",
);
export type HandlerContextGroupWithMetricsTypeId =
  typeof HandlerContextGroupWithMetricsTypeId;

interface Variance<in out HandlerT extends BaseHandlerT, out R> {
  [HandlerContextGroupWithMetricsTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextGroupWithMetricsVariance: <
  HandlerT extends BaseHandlerT,
  R,
>() => Variance<HandlerT, R>[HandlerContextGroupWithMetricsTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
});

const HandlerContextGroupWithMetricsTaggedClass = Data.TaggedClass(
  "HandlerContextGroupWithMetrics",
) as unknown as new <HandlerT extends BaseHandlerT, R = never>(
  args: Readonly<HandlerContextGroupWithMetricsObject<HandlerT, R>>,
) => Readonly<HandlerContextGroupWithMetricsObject<HandlerT, R>> & {
  readonly _tag: "HandlerContextGroupWithMetrics";
};

export class HandlerContextGroupWithMetrics<
    HandlerT extends BaseHandlerT,
    R = never,
  >
  extends HandlerContextGroupWithMetricsTaggedClass<HandlerT, R>
  implements Variance<HandlerT, R>
{
  [HandlerContextGroupWithMetricsTypeId] =
    handlerContextGroupWithMetricsVariance<HandlerT, R>();
}

export type HandlerContextGroupWithMetricsHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroupWithMetrics<any, any>,
> = Types.Invariant.Type<G[HandlerContextGroupWithMetricsTypeId]["_HandlerT"]>;
export type HandlerContextGroupWithMetricsContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroupWithMetrics<any, any>,
> = Types.Covariant.Type<G[HandlerContextGroupWithMetricsTypeId]["_R"]>;

export const make = <HandlerT extends BaseHandlerT, R = never>(
  handlerType: HandlerType<HandlerT>,
  group: HandlerContextGroup<HandlerT, R>,
): HandlerContextGroupWithMetrics<HandlerT, R> =>
  new HandlerContextGroupWithMetrics({
    group,
    handlerType,
    handlerCount: Metric.counter(`typhoon_handler_total`, {
      description: `The number of handler executions`,
      bigint: true,
      incremental: true,
    }),
  });

export const execute =
  <HandlerT extends BaseHandlerT>(
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
    groupWithMetrics: HandlerContextGroupWithMetrics<HandlerT, R>,
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
      groupWithMetrics.group,
      getHandlerContext(key),
      Option.map((context) =>
        pipe(
          handler(context) as Effect.Effect<
            Effect.Effect.Success<HandlerEffect>,
            Effect.Effect.Error<HandlerEffect>,
            R
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
      Effect.transposeMapOption(Effect.either),
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
    const G extends HandlerContextGroupWithMetrics<HandlerT, any>,
  >(
    groupWithMetrics: G,
  ) =>
    new HandlerContextGroupWithMetrics<
      HandlerT,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ?
            | HandlerContextGroupWithMetricsContext<G>
            | HandlerEffectContext<HandlerT, H>
        : never
    >(
      Struct.evolve(groupWithMetrics, {
        group: addHandlerContextGroup(handlerContextConfig),
      }),
    );

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<any, any>,
    HandlerT extends
      HandlerContextGroupHandlerT<OtherG> = HandlerContextGroupHandlerT<OtherG>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisG extends HandlerContextGroupWithMetrics<HandlerT, any>>(
    thisGroupWithMetrics: ThisG,
  ) =>
    new HandlerContextGroupWithMetrics<
      HandlerT,
      | HandlerContextGroupWithMetricsContext<ThisG>
      | HandlerContextGroupContext<OtherG>
    >(
      Struct.evolve(thisGroupWithMetrics, {
        group: addGroupHandlerContextGroup(otherGroup),
      }),
    );

export const initialize = <HandlerT extends BaseHandlerT, R = never>(
  groupWithMetrics: HandlerContextGroupWithMetrics<HandlerT, R>,
): Effect.Effect<void, never, never> =>
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
