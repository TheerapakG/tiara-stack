import { InteractionContext, RepliableInteractionT } from "@/services";
import { DiscordError } from "@/types/error/discordError";
import { InteractionResponse, Message, MessageFlags } from "discord.js";
import { Cause, Data, Effect, Metric, Option, pipe } from "effect";
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
  static make = <Data = unknown, A = never, E = never, R = never>(
    interactionType: string,
    map: InteractionHandlerMap<Data, A, E, R>,
  ) =>
    new InteractionHandlerMapWithMetrics({
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

  static add =
    <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
      context: InteractionHandlerContext<Data1, A1, E1, R1>,
    ) =>
    <A2 = never, E2 = never, R2 = never>(
      map: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(map.map, InteractionHandlerMap.add(context)),
        interactionType: map.interactionType,
        interactionCount: map.interactionCount,
      });

  static union =
    <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
      map: InteractionHandlerMap<Data1, A1, E1, R1>,
    ) =>
    <A2 = never, E2 = never, R2 = never>(
      other: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(other.map, InteractionHandlerMap.union(map)),
        interactionType: other.interactionType,
        interactionCount: other.interactionCount,
      });

  private static tagInteractionMetrics =
    (values: Record<string, string>) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      pipe(
        InteractionContext.guildId().sync(),
        Effect.flatMap((guildId) =>
          pipe(
            effect,
            Effect.tagMetrics({
              ...values,
              interaction_guild_id: pipe(
                guildId,
                Option.getOrElse(() => "unknown"),
              ),
            }),
          ),
        ),
        Effect.withSpan(
          "InteractionHandlerMapWithMetrics.tagInteractionMetrics",
          {
            captureStackTrace: true,
          },
        ),
      );

  static execute =
    (interactionKey: string) =>
    <Data, A, E, R>(map: InteractionHandlerMapWithMetrics<Data, A, E, R>) =>
      pipe(
        map.map,
        InteractionHandlerMap.get(interactionKey),
        Option.map(
          (context) => context.handler as InteractionHandler<A | void, E, R>,
        ),
        Option.getOrElse(() => Effect.void as Effect.Effect<A | void, E, R>),
        Effect.tapBoth({
          onSuccess: () =>
            pipe(
              map.interactionCount,
              Metric.update(BigInt(1)),
              InteractionHandlerMapWithMetrics.tagInteractionMetrics({
                interaction_key: interactionKey,
                interaction_type: map.interactionType,
                interaction_status: "success",
              }),
            ),
          onFailure: () =>
            pipe(
              map.interactionCount,
              Metric.update(BigInt(1)),
              InteractionHandlerMapWithMetrics.tagInteractionMetrics({
                interaction_key: interactionKey,
                interaction_type: map.interactionType,
                interaction_status: "failure",
              }),
            ),
        }),
        Effect.withSpan("InteractionHandlerMapWithMetrics.execute", {
          captureStackTrace: true,
        }),
      );

  static executeAndReplyError =
    (interactionKey: string) =>
    <Data, A, E, R>(map: InteractionHandlerMapWithMetrics<Data, A, E, R>) =>
      pipe(
        map,
        InteractionHandlerMapWithMetrics.execute(interactionKey),
        Effect.sandbox,
        Effect.tapBoth({
          onSuccess: () => Effect.void,
          onFailure: (cause) =>
            pipe(
              Effect.Do,
              InteractionContext.replied.bind("replied"),
              InteractionContext.deferred.bind("deferred"),
              Effect.tap(() => Effect.log(cause)),
              Effect.tap(({ replied, deferred }) =>
                pipe(
                  Effect.suspend<
                    Message | InteractionResponse,
                    Cause.UnknownException | DiscordError,
                    InteractionContext<RepliableInteractionT>
                  >(() =>
                    (replied || deferred
                      ? InteractionContext.followUp.sync
                      : InteractionContext.reply.sync)({
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

  static values = <Data, A, E, R>(
    map: InteractionHandlerMapWithMetrics<Data, A, E, R>,
  ) => InteractionHandlerMap.values(map.map);
}
