import { Data, Effect, HashMap, Metric, Option, pipe } from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataKey,
  HandlerType,
} from "../type";
import { handler as getHandlerFromContext } from "./context";
import { HandlerContextGroup, getHandlerContext } from "./group";

type HandlerContextGroupWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  group: HandlerContextGroup<HandlerT, R>;
  handlerType: HandlerType<HandlerT>;
  handlerCount: Metric.Metric.Counter<bigint>;
};

export class HandlerContextGroupWithMetrics<
  HandlerT extends BaseHandlerT,
  R = never,
> extends Data.TaggedClass("HandlerContextGroupWithMetrics")<
  HandlerContextGroupWithMetricsObject<HandlerT, R>
> {}

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
  <R>(
    groupWithMetrics: HandlerContextGroupWithMetrics<HandlerT, R>,
  ): Effect.Effect<void, unknown, R> =>
    pipe(
      getHandlerContext(key)(groupWithMetrics.group),
      Option.map(
        (context) =>
          getHandlerFromContext(context) as Handler<
            HandlerT,
            unknown,
            unknown,
            R
          >,
      ),
      Option.getOrElse(() => Effect.void as Effect.Effect<void, unknown, R>),
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
