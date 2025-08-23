import {
  FormatService,
  GuildConfigService,
  GuildService,
  PlayerService,
  SheetService,
} from "@/services/guild";
import {
  CachedInteractionContext,
  InteractionContext,
} from "@/services/interaction";
import { Effect, Layer, Option, pipe } from "effect";

export const guildServices = (guildId: string) =>
  pipe(
    Effect.succeed(
      pipe(
        FormatService.Default,
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
    CachedInteractionContext.guildId().sync(),
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
        onSome: Effect.succeed,
        onNone: () => CachedInteractionContext.guildId().sync(),
      }),
    ),
    Effect.map(guildServices),
    Effect.withSpan("guildServicesFromInteractionOption", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );
