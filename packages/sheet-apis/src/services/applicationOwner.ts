import { Cache, Duration, Effect, Exit, Layer, Option, Context } from "effect";
import { DiscordApiClient } from "dfx-discord-utils/discord";
import { discordLayer } from "@/services/discord";

const SUCCESS_TTL = Duration.hours(6);
const FAILURE_TTL = Duration.minutes(1);

export class ApplicationOwnerResolver extends Context.Service<ApplicationOwnerResolver>()(
  "ApplicationOwnerResolver",
  {
    make: Effect.gen(function* () {
      const discordApiClient = yield* DiscordApiClient;
      const application = yield* Cache.makeWith<string, Option.Option<string>>(
        Effect.fn("ApplicationOwnerResolver.lookup")(function* (_: string) {
          return yield* discordApiClient.application
            .getApplication({ responseMode: "decoded-only" })
            .pipe(
              Effect.match({
                onSuccess: (application) => Option.some(application.ownerId),
                onFailure: () => Option.none<string>(),
              }),
            );
        }),
        {
          capacity: 1,
          // `Option.none()` intentionally covers both "no owner available"
          // and transient lookup failures, so we keep the short retry TTL.
          timeToLive: Exit.match({
            onFailure: () => FAILURE_TTL,
            onSuccess: (ownerId) => (Option.isSome(ownerId) ? SUCCESS_TTL : FAILURE_TTL),
          }),
        },
      );

      return {
        getOwnerId: Effect.fn("ApplicationOwnerResolver.getOwnerId")(function* () {
          return yield* Cache.get(application, "owner");
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(ApplicationOwnerResolver, this.make).pipe(
    Layer.provide(discordLayer),
  );
}
