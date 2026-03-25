import { HttpServerRequest } from "@effect/platform";
import { Effect, Option, pipe } from "effect";

export const getOptionalGuildIdFromSearchParams = pipe(
  Effect.serviceOption(HttpServerRequest.ParsedSearchParams),
  Effect.map(
    Option.flatMap((searchParams) => {
      const guildId = searchParams.guildId;
      return typeof guildId === "string" ? Option.some(guildId) : Option.none<string>();
    }),
  ),
);

export const getOptionalGuildIdFromPayload = pipe(
  Effect.serviceOption(HttpServerRequest.HttpServerRequest),
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(Option.none<string>()),
      onSome: (request) => {
        if (request.method === "GET" || request.method === "HEAD") {
          return Effect.succeed(Option.none<string>());
        }

        const contentType = request.headers["content-type"]?.toLowerCase() ?? "";
        if (!contentType.includes("application/json")) {
          return Effect.succeed(Option.none<string>());
        }

        return request.json.pipe(
          Effect.map((body) =>
            typeof body === "object" &&
            body !== null &&
            "guildId" in body &&
            typeof body.guildId === "string"
              ? Option.some(body.guildId)
              : Option.none<string>(),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none<string>())),
        );
      },
    }),
  ),
);

export const getOptionalGuildId = Effect.gen(function* () {
  const maybeGuildIdFromSearchParams = yield* getOptionalGuildIdFromSearchParams;
  if (Option.isSome(maybeGuildIdFromSearchParams)) {
    return maybeGuildIdFromSearchParams;
  }

  return yield* getOptionalGuildIdFromPayload;
});
