import { Client, EmbedBuilder, Interaction } from "discord.js";
import { Effect, pipe } from "effect";

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
