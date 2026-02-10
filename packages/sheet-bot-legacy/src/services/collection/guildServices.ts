import {
  ConverterService,
  FormatService,
  GuildConfigService,
  GuildService,
  PlayerService,
  MonitorService,
  SheetService,
  ScreenshotService,
  ScheduleService,
} from "@/services/guild";
import { CachedInteractionContext, InteractionContext } from "@/services/interaction";
import { Effect, Layer, Option, pipe } from "effect";

export const guildServices = (guildId: string) =>
  pipe(
    FormatService.Default,
    Layer.provideMerge(ConverterService.Default),
    Layer.provideMerge(
      Layer.mergeAll(
        GuildConfigService.DefaultWithoutDependencies,
        SheetService.DefaultWithoutDependencies,
        PlayerService.DefaultWithoutDependencies,
        MonitorService.DefaultWithoutDependencies,
        ScreenshotService.DefaultWithoutDependencies,
        ScheduleService.DefaultWithoutDependencies,
      ),
    ),
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

export const guildServicesFromInteraction = () =>
  pipe(
    CachedInteractionContext.guildId().sync(),
    Effect.map(guildServices),
    Effect.withSpan("guildServicesFromInteraction", {
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
