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

const HandlerContextGroupWithMetricsTaggedClass: new <
  HandlerT extends BaseHandlerT,
  R = never,
>(
  args: Readonly<HandlerContextGroupWithMetricsObject<HandlerT, R>>,
) => Readonly<HandlerContextGroupWithMetricsObject<HandlerT, R>> & {
  readonly _tag: "HandlerContextGroupWithMetrics";
} = Data.TaggedClass("HandlerContextGroupWithMetrics");

export class HandlerContextGroupWithMetrics<
  HandlerT extends BaseHandlerT,
  R = never,
> extends HandlerContextGroupWithMetricsTaggedClass<HandlerT, R> {
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
}
