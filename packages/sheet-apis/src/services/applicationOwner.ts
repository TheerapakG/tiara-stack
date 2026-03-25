import { HttpClient, HttpClientRequest } from "@effect/platform";
import { Cache, Duration, Effect, Exit, Option, Schema } from "effect";
import { config } from "@/config";

const ApplicationOwnerResponse = Schema.Struct({
  ownerId: Schema.String,
});

const SUCCESS_TTL = Duration.hours(6);
const FAILURE_TTL = Duration.minutes(1);

export class ApplicationOwnerResolver extends Effect.Service<ApplicationOwnerResolver>()(
  "ApplicationOwnerResolver",
  {
    effect: Effect.all({
      cacheApiBaseUrl: config.cacheApiBaseUrl,
      httpClient: HttpClient.HttpClient,
    }).pipe(
      Effect.flatMap(({ cacheApiBaseUrl, httpClient }) =>
        Effect.gen(function* () {
          const application = yield* Cache.makeWith({
            capacity: 1,
            lookup: (): Effect.Effect<Option.Option<string>> =>
              HttpClientRequest.get(new URL("/cache/application", cacheApiBaseUrl)).pipe(
                httpClient.execute,
                Effect.flatMap((response) => response.json),
                Effect.flatMap(Schema.decodeUnknown(ApplicationOwnerResponse)),
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
