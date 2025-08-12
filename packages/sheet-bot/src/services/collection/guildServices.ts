import { Effect, Layer, pipe } from "effect";
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
