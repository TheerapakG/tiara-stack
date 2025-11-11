import { Data, Effect, Metric, Option, pipe } from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataKey,
} from "../type";
import { handler as getHandlerFromContext } from "./context";
import { HandlerContextGroup, getHandlerContext } from "./group";

type HandlerContextGroupWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  group: HandlerContextGroup<HandlerT, R>;
  handlerType: string;
  handlerCount: Metric.Metric.Counter<bigint>;
};

export class HandlerContextGroupWithMetrics<
  HandlerT extends BaseHandlerT,
  R = never,
> extends Data.TaggedClass("HandlerContextGroupWithMetrics")<
  HandlerContextGroupWithMetricsObject<HandlerT, R>
> {
  static make = <HandlerT extends BaseHandlerT, R = never>(
    handlerType: string,
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

  static execute =
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
                handler_type: groupWithMetrics.handlerType,
                handler_key: String(key),
                handler_status: "success",
              }),
            ),
          onFailure: () =>
            pipe(
              groupWithMetrics.handlerCount,
              Metric.update(BigInt(1)),
              Effect.tagMetrics({
                handler_type: groupWithMetrics.handlerType,
                handler_key: String(key),
                handler_status: "failure",
              }),
            ),
        }),
        Effect.withSpan("HandlerContextGroupWithMetrics.execute", {
          captureStackTrace: true,
        }),
      );

  static executeAndReplyError =
    <HandlerT extends BaseHandlerT>(
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
    ) =>
    <R>(
      groupWithMetrics: HandlerContextGroupWithMetrics<HandlerT, R>,
    ): Effect.Effect<void, unknown, R> =>
      pipe(
        groupWithMetrics,
        HandlerContextGroupWithMetrics.execute(key),
        Effect.sandbox,
        Effect.tapBoth({
          onSuccess: () => Effect.void,
          onFailure: (cause) =>
            pipe(
              Effect.logError(
                `Handler execution failed: ${String(key)}`,
                cause,
              ),
            ),
        }),
        Effect.unsandbox,
        Effect.withSpan("HandlerContextGroupWithMetrics.executeAndReplyError", {
          captureStackTrace: true,
        }),
      );
}
