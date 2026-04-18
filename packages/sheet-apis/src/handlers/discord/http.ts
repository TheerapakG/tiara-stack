import { GuildsApiCacheView } from "dfx-discord-utils/discord/cache/guilds";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Redacted, Schema } from "effect";
import { getDiscordAccessToken } from "sheet-auth/client";
import { makeArgumentError } from "typhoon-core/error";
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
      .handle(
        "getCurrentUser",
        Effect.fnUntraced(function* () {
          const headers = yield* HttpServerRequest.schemaHeaders(
            Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
          );

          const authHeaders: Record<string, string> = {};
          if (typeof headers.origin === "string") authHeaders.origin = headers.origin;
          if (typeof headers.cookie === "string") authHeaders.cookie = headers.cookie;

          const tokenResult = yield* getDiscordAccessToken(authClient, authHeaders).pipe(
            Effect.mapError((error) =>
              makeArgumentError(
                `Failed to get Discord access token: ${error.message}. ` +
                  "Ensure the user has authenticated with Discord.",
              ),
            ),
          );

          const discordResponse = yield* Effect.promise(() =>
            fetch("https://discord.com/api/v10/users/@me", {
              headers: {
                Authorization: `Bearer ${Redacted.value(tokenResult.accessToken)}`,
              },
            }),
          );
          if (!discordResponse.ok) {
            return yield* Effect.fail(
              makeArgumentError(`Failed to fetch Discord user: ${discordResponse.statusText}`),
            );
          }

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
      .handle(
        "getCurrentUserGuilds",
        Effect.fnUntraced(function* () {
          const headers = yield* HttpServerRequest.schemaHeaders(
            Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
          );

          const authHeaders: Record<string, string> = {};
          if (typeof headers.origin === "string") authHeaders.origin = headers.origin;
          if (typeof headers.cookie === "string") authHeaders.cookie = headers.cookie;

          const tokenResult = yield* getDiscordAccessToken(authClient, authHeaders).pipe(
            Effect.mapError((error) =>
              makeArgumentError(
                `Failed to get Discord access token: ${error.message}. ` +
                  "Ensure the user has authenticated with Discord.",
              ),
            ),
          );

          const discordResponse = yield* Effect.promise(() =>
            fetch("https://discord.com/api/v10/users/@me/guilds", {
              headers: {
                Authorization: `Bearer ${Redacted.value(tokenResult.accessToken)}`,
              },
            }),
          );
          if (!discordResponse.ok) {
            return yield* Effect.fail(
              makeArgumentError(`Failed to fetch Discord guilds: ${discordResponse.statusText}`),
            );
          }

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
              guildsCache.get(id).pipe(
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
