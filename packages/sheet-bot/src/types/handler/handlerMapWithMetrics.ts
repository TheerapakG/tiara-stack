import { InteractionResponse, Message, MessageFlags } from "discord.js";
import { Cause, Data, Effect, Metric, Option, pipe } from "effect";
import { InteractionContext, RepliableInteractionT } from "../../services";
import { bindObject } from "../../utils";
import {
  InteractionHandler,
  InteractionHandlerContext,
  InteractionHandlerMap,
} from "./handler";

type InteractionHandlerMapWithMetricsObject<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> = {
  map: InteractionHandlerMap<Data, A, E, R>;
  interactionType: string;
  interactionCount: Metric.Metric.Counter<bigint>;
};

export class InteractionHandlerMapWithMetrics<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMapWithMetrics")<
  InteractionHandlerMapWithMetricsObject<Data, A, E, R>
> {
  static make<Data = unknown, A = never, E = never, R = never>(
    interactionType: string,
    map: InteractionHandlerMap<Data, A, E, R>,
  ) {
    return new InteractionHandlerMapWithMetrics({
      map,
      interactionType,
      interactionCount: Metric.counter(
        `typhoon_discord_bot_interaction_total`,
        {
          description: `The number of interactions with the bot`,
          bigint: true,
          incremental: true,
        },
      ),
    });
  }

  static add<Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, A1, E1, R1>,
  ) {
    return <A2 = never, E2 = never, R2 = never>(
      map: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(map.map, InteractionHandlerMap.add(context)),
        interactionType: map.interactionType,
        interactionCount: map.interactionCount,
      });
  }

  static union<Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    map: InteractionHandlerMap<Data1, A1, E1, R1>,
  ) {
    return <A2 = never, E2 = never, R2 = never>(
      other: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(other.map, InteractionHandlerMap.union(map)),
        interactionType: other.interactionType,
        interactionCount: other.interactionCount,
      });
  }

  static execute(interactionKey: string) {
    return <Data, A, E, R>(
      map: InteractionHandlerMapWithMetrics<Data, A, E, R>,
    ) =>
      pipe(
        map.map,
        InteractionHandlerMap.get(interactionKey),
        Option.map(
          (command) => command.handler as InteractionHandler<A | void, E, R>,
        ),
        Option.getOrElse(() => Effect.void as Effect.Effect<A | void, E, R>),
        Effect.tapBoth({
          onSuccess: () =>
            pipe(
              map.interactionCount,
              Metric.update(BigInt(1)),
              Effect.tagMetrics("interaction_status", "success"),
            ),
          onFailure: () =>
            pipe(
              map.interactionCount,
              Metric.update(BigInt(1)),
              Effect.tagMetrics("interaction_status", "failure"),
            ),
        }),
        Effect.tagMetrics("interaction_type", map.interactionType),
        Effect.tagMetrics("interaction_key", interactionKey),
        Effect.withSpan("InteractionHandlerMapWithMetrics.execute", {
          captureStackTrace: true,
        }),
      );
  }

  static executeAndReplyError(interactionKey: string) {
    return <Data, A, E, R>(
      map: InteractionHandlerMapWithMetrics<Data, A, E, R>,
    ) =>
      pipe(
        map,
        InteractionHandlerMapWithMetrics.execute(interactionKey),
        Effect.sandbox,
        Effect.tapBoth({
          onSuccess: () => Effect.void,
          onFailure: (cause) =>
            pipe(
              Effect.Do,
              bindObject({
                cause: Effect.succeed(cause),
                replied: InteractionContext.replied(),
                deferred: InteractionContext.deferred(),
              }),
              Effect.tap(({ cause }) => Effect.log(cause)),
              Effect.tap(({ cause, replied, deferred }) =>
                pipe(
                  Effect.suspend<
                    Message | InteractionResponse,
                    Cause.UnknownException,
                    InteractionContext<RepliableInteractionT>
                  >(() =>
                    (replied || deferred
                      ? InteractionContext.followUp.effect
                      : InteractionContext.reply.effect)({
                      content: Cause.pretty(cause),
                      flags: MessageFlags.Ephemeral,
                    }),
                  ),
                  // TODO: handle errors
                  Effect.catchAll(() => Effect.void),
                ),
              ),
            ),
        }),
        Effect.unsandbox,
        Effect.withSpan(
          "InteractionHandlerMapWithMetrics.executeAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );
  }

  static values<Data, A, E, R>(
    map: InteractionHandlerMapWithMetrics<Data, A, E, R>,
  ) {
    return InteractionHandlerMap.values(map.map);
  }
}
