import { Cache, Duration, Effect, Exit, Option } from "effect";
import { DiscordApiClient } from "dfx-discord-utils/discord";

const SUCCESS_TTL = Duration.hours(6);
const FAILURE_TTL = Duration.minutes(1);

export class ApplicationOwnerResolver extends Effect.Service<ApplicationOwnerResolver>()(
  "ApplicationOwnerResolver",
  {
    effect: Effect.all({
      discordApiClient: DiscordApiClient,
    }).pipe(
      Effect.flatMap(({ discordApiClient }) =>
        Effect.gen(function* () {
          const application = yield* Cache.makeWith({
            capacity: 1,
            lookup: (): Effect.Effect<Option.Option<string>> =>
              discordApiClient.application.getApplication().pipe(
                Effect.map((application) => Option.some(application.ownerId)),
                Effect.catchAll(() => Effect.succeed(Option.none<string>())),
              ),
            // `Option.none()` intentionally covers both "no owner available"
            // and transient lookup failures, so we keep the short retry TTL.
            timeToLive: Exit.match({
              onFailure: () => FAILURE_TTL,
              onSuccess: (ownerId) => (Option.isSome(ownerId) ? SUCCESS_TTL : FAILURE_TTL),
            }),
          });

          return {
            getOwnerId: Effect.fn("ApplicationOwnerResolver.getOwnerId")(() =>
              application.get("owner"),
            ),
          };
        }),
      ),
    ),
  },
) {}
