import { GuildsApiCacheView } from "dfx-discord-utils/discord/cache/guilds";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Redacted, Schema } from "effect";
import { makeArgumentError } from "typhoon-core/error";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { Discord } from "@/schema";
import { discordLayer as discordServiceLayer } from "@/services";

const forwardedDiscordHeaders = Schema.Struct({
  "x-sheet-discord-access-token": Schema.optional(Schema.String),
});

const DiscordMyGuild = Schema.Struct({
  id: Schema.String,
});

const getForwardedDiscordAccessToken = Effect.fn("getForwardedDiscordAccessToken")(function* () {
  const headers = yield* HttpServerRequest.schemaHeaders(forwardedDiscordHeaders);
  if (!headers["x-sheet-discord-access-token"]) {
    return yield* Effect.fail(makeArgumentError("Missing forwarded Discord access token"));
  }
  return Redacted.make(headers["x-sheet-discord-access-token"]);
});

export const discordLayer = HttpApiBuilder.group(
  Api,
  "discord",
  Effect.fn(function* (handlers) {
    const guildsCache = yield* GuildsApiCacheView;

    return handlers
      .handle(
        "getCurrentUser",
        Effect.fnUntraced(function* () {
          const accessToken = yield* getForwardedDiscordAccessToken();

          const discordResponse = yield* Effect.promise(() =>
            fetch("https://discord.com/api/v10/users/@me", {
              headers: {
                Authorization: `Bearer ${Redacted.value(accessToken)}`,
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
          const accessToken = yield* getForwardedDiscordAccessToken();

          const discordResponse = yield* Effect.promise(() =>
            fetch("https://discord.com/api/v10/users/@me/guilds", {
              headers: {
                Authorization: `Bearer ${Redacted.value(accessToken)}`,
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
).pipe(Layer.provide([discordServiceLayer, SheetAuthTokenAuthorizationLive]));
