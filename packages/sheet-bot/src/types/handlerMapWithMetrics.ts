import { Data, Effect, Metric, Option, pipe } from "effect";
import { InteractionHandlerContext, InteractionHandlerMap } from "./handler";

type InteractionHandlerMapWithMetricsObject<
  Data = unknown,
  E = never,
  R = never,
> = {
  map: InteractionHandlerMap<Data, E, R>;
  interactionType: string;
  interactionCount: Metric.Metric.Counter<bigint>;
};

export class InteractionHandlerMapWithMetrics<
  Data = unknown,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMapWithMetrics")<
  InteractionHandlerMapWithMetricsObject<Data, E, R>
> {
  static make<Data = unknown, E = never, R = never>(
    interactionType: string,
    map: InteractionHandlerMap<Data, E, R>,
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

  static add<Data1 extends Data2, Data2, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, E1, R1>,
  ) {
    return <E2 = never, R2 = never>(
      map: InteractionHandlerMapWithMetrics<Data2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(map.map, InteractionHandlerMap.add(context)),
        interactionType: map.interactionType,
        interactionCount: map.interactionCount,
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
        interactionType: other.interactionType,
        interactionCount: other.interactionCount,
      });
  }

  static execute(interactionKey: string) {
    return <Data, E, R>(map: InteractionHandlerMapWithMetrics<Data, E, R>) =>
      pipe(
        map.map,
        InteractionHandlerMap.get(interactionKey),
        Option.map((command) => command.handler),
        Option.getOrElse(() => Effect.void as Effect.Effect<unknown, E, R>),
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
      );
  }

  static values<Data, E, R>(map: InteractionHandlerMapWithMetrics<Data, E, R>) {
    return InteractionHandlerMap.values(map.map);
  }
}
