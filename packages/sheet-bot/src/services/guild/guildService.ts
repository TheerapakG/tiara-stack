import { Guild, Interaction } from "discord.js";
import { Effect, Layer, pipe } from "effect";
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
      CachedInteractionContext.interaction<Interaction>(),
      Effect.map((interaction) => GuildService.Default(interaction.guild)),
      Effect.withSpan("GuildService.fromInteraction", {
        captureStackTrace: true,
      }),
      Layer.unwrapEffect,
    );
  }
}
