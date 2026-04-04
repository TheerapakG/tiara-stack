import { GuildsApiCacheView } from "dfx-discord-utils/discord/cache/guilds";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, pipe, Redacted, Schema } from "effect";
import { getDiscordAccessToken } from "sheet-auth/client";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { Discord } from "@/schema";
import { SheetAuthClient, discordLayer as discordServiceLayer } from "@/services";

const DiscordMyGuild = Schema.Struct({
  id: Schema.String,
});

export const discordLayer = HttpApiBuilder.group(
  Api,
  "discord",
  Effect.fn(function* (handlers) {
    const authClient = yield* SheetAuthClient;
    const guildsCache = yield* GuildsApiCacheView;

    return handlers
      .handle("getCurrentUser", () =>
        Effect.gen(function* () {
          const headers = yield* HttpServerRequest.schemaHeaders(
            Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
          ).pipe(catchSchemaErrorAsValidationError);

          const authHeaders: Record<string, string> = {};
          if (typeof headers.origin === "string") authHeaders.origin = headers.origin;
          if (typeof headers.cookie === "string") authHeaders.cookie = headers.cookie;

          const tokenResult = yield* pipe(
            getDiscordAccessToken(authClient, authHeaders),
            Effect.mapError((error) =>
              makeArgumentError(
                `Failed to get Discord access token: ${error.message}. ` +
                  "Ensure the user has authenticated with Discord.",
              ),
            ),
          );

          const discordResponse = yield* pipe(
            Effect.promise(() =>
              fetch("https://discord.com/api/v10/users/@me", {
                headers: {
                  Authorization: `Bearer ${Redacted.value(tokenResult.accessToken)}`,
                },
              }),
            ),
            Effect.flatMap((response) =>
              response.ok
                ? Effect.succeed(response)
                : Effect.fail(
                    makeArgumentError(`Failed to fetch Discord user: ${response.statusText}`),
                  ),
            ),
          );

          const json = yield* Effect.tryPromise({
            try: () => discordResponse.json(),
            catch: (error) =>
              makeArgumentError(`Failed to parse Discord response: ${String(error)}`),
          });

          return yield* Schema.decodeUnknownEffect(Discord.DiscordUser)(json).pipe(
            Effect.mapError((error) =>
              makeArgumentError(`Invalid response from Discord API: ${String(error)}`),
            ),
          );
        }),
      )
      .handle("getCurrentUserGuilds", () =>
        Effect.gen(function* () {
          const headers = yield* HttpServerRequest.schemaHeaders(
            Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
          ).pipe(catchSchemaErrorAsValidationError);

          const authHeaders: Record<string, string> = {};
          if (typeof headers.origin === "string") authHeaders.origin = headers.origin;
          if (typeof headers.cookie === "string") authHeaders.cookie = headers.cookie;

          const tokenResult = yield* pipe(
            getDiscordAccessToken(authClient, authHeaders),
            Effect.mapError((error) =>
              makeArgumentError(
                `Failed to get Discord access token: ${error.message}. ` +
                  "Ensure the user has authenticated with Discord.",
              ),
            ),
          );

          const discordResponse = yield* pipe(
            Effect.promise(() =>
              fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: {
                  Authorization: `Bearer ${Redacted.value(tokenResult.accessToken)}`,
                },
              }),
            ),
            Effect.flatMap((response) =>
              response.ok
                ? Effect.succeed(response)
                : Effect.fail(
                    makeArgumentError(`Failed to fetch Discord guilds: ${response.statusText}`),
                  ),
            ),
          );

          const json = yield* Effect.tryPromise({
            try: () => discordResponse.json(),
            catch: (error) =>
              makeArgumentError(`Failed to parse Discord response: ${String(error)}`),
          });

          const userGuilds = yield* Schema.decodeUnknownEffect(Schema.Array(DiscordMyGuild))(
            json,
          ).pipe(
            Effect.mapError((error) =>
              makeArgumentError(`Invalid response from Discord API: ${String(error)}`),
            ),
          );

          const maybeGuilds = yield* Effect.forEach(
            userGuilds,
            ({ id }) =>
              pipe(
                guildsCache.get(id),
                Effect.matchEffect({
                  onSuccess: (guild) => Effect.succeed(guild),
                  onFailure: () => Effect.succeed(null),
                }),
              ),
            { concurrency: "unbounded" },
          );

          const cachedGuilds = maybeGuilds.filter(
            (guild): guild is NonNullable<typeof guild> => guild !== null,
          );

          return yield* Schema.decodeUnknownEffect(Schema.Array(Discord.DiscordGuild))(
            cachedGuilds,
          ).pipe(
            Effect.mapError((error) =>
              makeArgumentError(`Invalid cached guild data: ${String(error)}`),
            ),
          );
        }),
      );
  }),
).pipe(
  Layer.provide([SheetAuthClient.layer, discordServiceLayer, SheetAuthTokenAuthorizationLive]),
);
