import {
  ConverterService,
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
    GuildConfigService.DefaultWithoutDependencies,
    Layer.provideMerge(GuildService.fromGuildId(guildId)),
    Effect.succeed,
    Effect.withSpan("guildServices", {
      captureStackTrace: true,
      attributes: {
        guildId,
      },
    }),
    Layer.unwrapEffect,
  );

export const guildSheetServices = (guildId: string) =>
  pipe(
    FormatService.Default,
    Layer.provideMerge(
      Layer.mergeAll(ConverterService.Default, PlayerService.Default),
    ),
    Layer.provideMerge(SheetService.ofGuild()),
    Layer.provideMerge(guildServices(guildId)),
    Effect.succeed,
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
    Effect.withSpan("guildServicesFromInteraction", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );

export const guildSheetServicesFromInteraction = () =>
  pipe(
    CachedInteractionContext.guildId().sync(),
    Effect.map(guildSheetServices),
    Effect.withSpan("guildSheetServicesFromInteraction", {
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

export const guildSheetServicesFromInteractionOption = (name: string) =>
  pipe(
    InteractionContext.getString(name),
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => CachedInteractionContext.guildId().sync(),
      }),
    ),
    Effect.map(guildSheetServices),
    Effect.withSpan("guildSheetServicesFromInteractionOption", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );
