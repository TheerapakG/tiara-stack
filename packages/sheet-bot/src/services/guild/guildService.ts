import { Guild } from "discord.js";
import { Effect, Layer, Option, pipe } from "effect";
import { CachedInteractionContext } from "../../types";
import { ClientService } from "../interaction/clientService";

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
            Effect.tryPromise(() => guild.members.fetch()),
            Effect.withSpan("GuildService.fetchMembers", {
              captureStackTrace: true,
            }),
          ),
        fetchRole: (roleId: string) =>
          pipe(
            Effect.tryPromise(() => guild.roles.fetch(roleId)),
            Effect.map(Option.fromNullable),
            Effect.withSpan("GuildService.fetchRole", {
              captureStackTrace: true,
            }),
          ),
        fetchChannel: (channelId: string) =>
          pipe(
            Effect.tryPromise(() => guild.channels.fetch(channelId)),
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
      ClientService.getClient(),
      Effect.flatMap((client) =>
        Effect.tryPromise(() => client.guilds.fetch(guildId)),
      ),
      Effect.map((guild) => GuildService.Default(guild)),
      Effect.withSpan("GuildService.fromGuildId", {
        captureStackTrace: true,
      }),
      Layer.unwrapEffect,
    );
  }

  static fromInteraction() {
    return pipe(
      CachedInteractionContext.guild(),
      Effect.map((guild) => GuildService.Default(guild)),
      Effect.withSpan("GuildService.fromInteraction", {
        captureStackTrace: true,
      }),
      Layer.unwrapEffect,
    );
  }
}
