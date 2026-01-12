import { Effect, Function, GlobalValue, Metric, Option, pipe } from "effect";
import type { BaseHandlerT, Handler, HandlerData, HandlerDataKey, HandlerType } from "./type";

const metrics = GlobalValue.globalValue(Symbol.for("Typhoon/Handler/Metrics"), () => ({
  handlerCount: Metric.counter(`typhoon_handler_total`, {
    description: `The number of handler executions`,
    bigint: true,
    incremental: true,
  }),
}));

export const initializeMetrics = <HandlerT extends BaseHandlerT>(
  type: HandlerType<HandlerT>,
  key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
): Effect.Effect<void, never, never> =>
  pipe(
    ["success", "failure"],
    Effect.forEach(
      (handlerStatus) =>
        pipe(
          metrics.handlerCount,
          Metric.update(BigInt(0)),
          Effect.tagMetrics({
            handler_type: type,
            handler_key: key,
            handler_status: handlerStatus,
          }),
        ),
      { discard: true },
    ),
    Effect.withSpan("Handler.initializeMetrics", {
      captureStackTrace: true,
    }),
  );

export const execute = <HandlerT extends BaseHandlerT, R>() =>
  Function.dual<
    <const ExecutorResult extends Effect.Effect<any, any, any>>(
      type: HandlerType<HandlerT>,
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
      executor: (handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>) => ExecutorResult,
    ) => (handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>) => ExecutorResult,
    <const ExecutorResult extends Effect.Effect<any, any, any>>(
      handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>,
      type: HandlerType<HandlerT>,
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
      executor: (handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>) => ExecutorResult,
    ) => ExecutorResult
  >(
    4,
    <const ExecutorResult extends Effect.Effect<any, any, any>>(
      handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>,
      type: HandlerType<HandlerT>,
      key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
      executor: (handler: Option.Option<Handler<HandlerT, unknown, unknown, R>>) => ExecutorResult,
    ) =>
      pipe(
        executor(handler),
        Effect.tapBoth({
          onSuccess: () =>
            pipe(
              metrics.handlerCount,
              Metric.update(BigInt(1)),
              Effect.tagMetrics({
                handler_type: type,
                handler_key: key,
                handler_status: "success",
              }),
            ),
          onFailure: () =>
            pipe(
              metrics.handlerCount,
              Metric.update(BigInt(1)),
              Effect.tagMetrics({
                handler_type: type,
                handler_key: key,
                handler_status: "failure",
              }),
            ),
        }),
        Effect.withSpan("Handler.execute", {
          captureStackTrace: true,
        }),
      ) as ExecutorResult,
  );
