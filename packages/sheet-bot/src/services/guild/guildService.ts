import {
  CachedInteractionContext,
  ClientService,
} from "@/services/interaction";
import { Guild } from "discord.js";
import { Effect, Layer, Option, pipe } from "effect";
import { DiscordError } from "~~/src/types";

export class GuildService extends Effect.Service<GuildService>()(
  "GuildService",
  {
    effect: (guild: Guild) =>
      Effect.succeed({
        getGuild: () =>
          pipe(
            Effect.succeed(guild),
            Effect.withSpan("GuildService.getGuild", {
              captureStackTrace: true,
            }),
          ),
        getId: () =>
          pipe(
            Effect.succeed(guild.id),
            Effect.withSpan("GuildService.getId", {
              captureStackTrace: true,
            }),
          ),
        getName: () =>
          pipe(
            Effect.succeed(guild.name),
            Effect.withSpan("GuildService.getName", {
              captureStackTrace: true,
            }),
          ),
        fetchMembers: () =>
          pipe(
            DiscordError.wrapTryPromise(() => guild.members.fetch()),
            Effect.withSpan("GuildService.fetchMembers", {
              captureStackTrace: true,
            }),
          ),
        fetchRole: (roleId: string) =>
          pipe(
            DiscordError.wrapTryPromise(() => guild.roles.fetch(roleId)),
            Effect.map(Option.fromNullable),
            Effect.withSpan("GuildService.fetchRole", {
              captureStackTrace: true,
            }),
          ),
        fetchChannel: (channelId: string) =>
          pipe(
            DiscordError.wrapTryPromise(() => guild.channels.fetch(channelId)),
            Effect.map(Option.fromNullable),
            Effect.withSpan("GuildService.fetchChannel", {
              captureStackTrace: true,
            }),
          ),
      }),
    accessors: true,
  },
) {
  static fromGuildId(guildId: string) {
    return pipe(
      ClientService.fetchGuild(guildId),
      Effect.map((guild) => GuildService.Default(guild)),
      Effect.withSpan("GuildService.fromGuildId", {
        captureStackTrace: true,
      }),
      Layer.unwrapEffect,
    );
  }

  static fromInteraction() {
    return pipe(
      CachedInteractionContext.guild().sync(),
      Effect.map((guild) => GuildService.Default(guild)),
      Effect.withSpan("GuildService.fromInteraction", {
        captureStackTrace: true,
      }),
      Layer.unwrapEffect,
    );
  }
}
