import { Effect, DateTime } from "effect";
import { EmbedBuilder } from "@discordjs/builders";
import { DiscordApplication } from "../discord/gateway";

export class EmbedService extends Effect.Service<EmbedService>()("PermissionService", {
  effect: Effect.gen(function* () {
    const application = yield* DiscordApplication;

    return {
      makeBaseEmbedBuilder: () =>
        DateTime.now.pipe(
          Effect.map(
            (now) =>
              new EmbedBuilder({
                timestamp: DateTime.formatIso(now),
                footer: {
                  text: `${application.bot?.username} ${process.env.BUILD_VERSION} by Theerie (@theerapakg)`,
                },
              }),
          ),
        ),
    };
  }),
  accessors: true,
  dependencies: [DiscordApplication.Default],
}) {}
