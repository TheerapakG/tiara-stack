import { DateTime, Effect, Layer, ServiceMap } from "effect";
import { EmbedBuilder } from "@discordjs/builders";
import { DiscordApplication } from "dfx-discord-utils/discord";

export class EmbedService extends ServiceMap.Service<EmbedService>()("EmbedService", {
  make: Effect.gen(function* () {
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
      makeWebScheduleEmbed: () =>
        Effect.succeed(
          new EmbedBuilder({
            description:
              "📅 **Preview**: View your schedule online at <https://schedule.theerapakg.moe/>",
            color: 0x5865f2,
          }),
        ),
    };
  }),
}) {
  static layer = Layer.effect(EmbedService, this.make).pipe(
    Layer.provide(DiscordApplication.layer),
  );
}
