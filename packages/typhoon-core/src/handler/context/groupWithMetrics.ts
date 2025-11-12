import { Data, Effect, Either, HashMap, Metric, Option, pipe } from "effect";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataKey,
  HandlerType,
  HandlerSuccess,
  HandlerError,
} from "../type";
import { handler } from "./context";
import { HandlerContextGroup, getHandlerContext } from "./group";

type HandlerContextGroupWithMetricsObject<
  HandlerT extends BaseHandlerT,
  R = never,
> = {
  group: HandlerContextGroup<HandlerT, R>;
  handlerType: HandlerType<HandlerT>;
  handlerCount: Metric.Metric.Counter<bigint>;
};

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
> extends HandlerContextGroupWithMetricsTaggedClass<HandlerT, R> {}

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
      groupWithMetrics.group,
      getHandlerContext(key),
      Option.map((context) =>
        pipe(
          handler(context) as Effect.Effect<
            HandlerSuccess<HandlerT, Handler<HandlerT, unknown, unknown, R>>,
            HandlerError<HandlerT, Handler<HandlerT, unknown, unknown, R>>,
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
