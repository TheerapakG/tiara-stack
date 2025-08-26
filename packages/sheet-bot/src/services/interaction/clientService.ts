import { Client, EmbedBuilder, Interaction } from "discord.js";
import { Effect, Option, pipe } from "effect";

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
            Effect.tryPromise(() => client.application.fetch()),
            Effect.withSpan("ClientService.fetchApplication", {
              captureStackTrace: true,
            }),
          ),
        makeEmbedBuilder: () =>
          new EmbedBuilder().setTimestamp().setFooter({
            text: `${client.user.username} ${process.env.BUILD_VERSION}`,
          }),
      }),
    accessors: true,
  },
) {
  static fromInteraction(interaction: Interaction) {
    return ClientService.Default(interaction.client);
  }
}
