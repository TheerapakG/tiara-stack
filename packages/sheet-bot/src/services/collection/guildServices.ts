import { Effect, Layer, Option, pipe } from "effect";
import { CachedInteractionContext, InteractionContext } from "../../types";
import {
  GuildConfigService,
  GuildService,
  PlayerService,
  ScheduleService,
  SheetService,
} from "../guild";

export const guildServices = (guildId: string) =>
  pipe(
    Effect.succeed(
      pipe(
        ScheduleService.Default,
        Layer.provideMerge(PlayerService.Default),
        Layer.provideMerge(SheetService.ofGuild()),
        Layer.provideMerge(GuildConfigService.DefaultWithoutDependencies),
        Layer.provideMerge(GuildService.fromGuildId(guildId)),
      ),
    ),
    Effect.withSpan("guildServices", {
      captureStackTrace: true,
      attributes: {
        guildId,
      },
    }),
    Layer.unwrapEffect,
  );

export const guildServicesFromInteraction = () =>
  pipe(
    CachedInteractionContext.guildId(),
    Effect.map(guildServices),
    Effect.withSpan("guildServicesFromInteractionOption", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );

export const guildServicesFromInteractionOption = (name: string) =>
  pipe(
    InteractionContext.getString(name),
    Effect.flatMap(
      Option.match({
        onSome: (guildId) => Effect.succeed(guildId),
        onNone: () => CachedInteractionContext.guildId(),
      }),
    ),
    Effect.map(guildServices),
    Effect.withSpan("guildServicesFromInteractionOption", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );
