import { Client, EmbedBuilder, Interaction } from "discord.js";
import { Effect, HashMap, Option, pipe } from "effect";
import { DiscordError } from "~~/src/types";

export class ClientService extends Effect.Service<ClientService>()(
  "ClientService",
  {
    effect: (client: Client<true>) =>
      Effect.succeed({
        getClient: () =>
          pipe(
            Effect.succeed(client),
            Effect.withSpan("ClientService.getClient", {
              captureStackTrace: true,
            }),
          ),
        getApplicationOwner: () =>
          pipe(
            Effect.succeed(Option.fromNullable(client.application.owner)),
            Effect.withSpan("ClientService.getApplicationOwner", {
              captureStackTrace: true,
            }),
          ),
        fetchApplication: () =>
          pipe(
            DiscordError.wrapTryPromise(() => client.application.fetch()),
            Effect.withSpan("ClientService.fetchApplication", {
              captureStackTrace: true,
            }),
          ),
        getGuilds: () =>
          pipe(
            client.guilds.cache,
            HashMap.fromIterable,
            Effect.succeed,
            Effect.withSpan("ClientService.getGuilds", {
              captureStackTrace: true,
            }),
          ),
        fetchGuilds: () =>
          pipe(
            DiscordError.wrapTryPromise(() => client.guilds.fetch()),
            Effect.withSpan("ClientService.fetchGuilds", {
              captureStackTrace: true,
            }),
          ),
        fetchGuild: (guildId: string) =>
          pipe(
            DiscordError.wrapTryPromise(() => client.guilds.fetch(guildId)),
            Effect.withSpan("ClientService.fetchGuild", {
              captureStackTrace: true,
            }),
          ),
        makeEmbedBuilder: () =>
          new EmbedBuilder().setTimestamp().setFooter({
            text: `${client.user.username} ${process.env.BUILD_VERSION} by Theerie (@theerapakg)`,
          }),
      }),
    accessors: true,
  },
) {
  static fromInteraction = (interaction: Interaction) =>
    ClientService.Default(interaction.client);
}
