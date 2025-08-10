import { Data, Effect, Metric, Option, pipe } from "effect";
import { InteractionHandlerContext, InteractionHandlerMap } from "./handler";

type InteractionHandlerMapWithMetricsObject<
  Data = unknown,
  E = never,
  R = never,
> = {
  map: InteractionHandlerMap<Data, E, R>;
  interactionCount: Metric.Metric.Counter<bigint>;
  interactionSuccessCount: Metric.Metric.Counter<bigint>;
  interactionErrorCount: Metric.Metric.Counter<bigint>;
};

export class InteractionHandlerMapWithMetrics<
  Data = unknown,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMapWithMetrics")<
  InteractionHandlerMapWithMetricsObject<Data, E, R>
> {
  static make<Data = unknown, E = never, R = never>(
    interactionName: string,
    map: InteractionHandlerMap<Data, E, R>,
  ) {
    return new InteractionHandlerMapWithMetrics({
      map,
      interactionCount: Metric.counter(
        `typhooon_discord_bot_${interactionName}_interaction_count`,
        {
          description: `The number of ${interactionName} interactions with the bot`,
          bigint: true,
          incremental: true,
        },
      ),
      interactionSuccessCount: Metric.counter(
        `typhooon_discord_bot_${interactionName}_interaction_success_count`,
        {
          description: `The number of successful ${interactionName} interactions with the bot`,
          bigint: true,
          incremental: true,
        },
      ),
      interactionErrorCount: Metric.counter(
        `typhooon_discord_bot_${interactionName}_interaction_error_count`,
        {
          description: `The number of error ${interactionName} interactions with the bot`,
          bigint: true,
          incremental: true,
        },
      ),
    });
  }

  static add<Data1 extends Data2, Data2, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, E1, R1>,
  ) {
    return <E2 = never, R2 = never>(
      map: InteractionHandlerMapWithMetrics<Data2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(map.map, InteractionHandlerMap.add(context)),
        interactionCount: map.interactionCount,
        interactionSuccessCount: map.interactionSuccessCount,
        interactionErrorCount: map.interactionErrorCount,
      });
  }

  static union<Data1 extends Data2, Data2, E1 = never, R1 = never>(
    map: InteractionHandlerMap<Data1, E1, R1>,
  ) {
    return <E2 = never, R2 = never>(
      other: InteractionHandlerMapWithMetrics<Data2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(other.map, InteractionHandlerMap.union(map)),
        interactionCount: other.interactionCount,
        interactionSuccessCount: other.interactionSuccessCount,
        interactionErrorCount: other.interactionErrorCount,
      });
  }

  static execute(commandName: string) {
    return <Data, E, R>(map: InteractionHandlerMapWithMetrics<Data, E, R>) =>
      pipe(
        map.map,
        InteractionHandlerMap.get(commandName),
        Option.map((command) => command.handler),
        Option.getOrElse(() => Effect.void as Effect.Effect<unknown, E, R>),
        Effect.tapBoth({
          onSuccess: () =>
            pipe(
              Effect.succeed(BigInt(1)),
              map.interactionSuccessCount,
              map.interactionCount,
            ),
          onFailure: () =>
            pipe(
              Effect.succeed(BigInt(1)),
              map.interactionErrorCount,
              map.interactionCount,
            ),
        }),
      );
  }

  static values<Data, E, R>(map: InteractionHandlerMapWithMetrics<Data, E, R>) {
    return InteractionHandlerMap.values(map.map);
  }
}
