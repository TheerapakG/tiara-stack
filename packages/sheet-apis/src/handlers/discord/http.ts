import { GuildsApiCacheView } from "dfx-discord-utils/discord/cache/guilds";
import { HttpClient } from "effect/unstable/http";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { makeArgumentError } from "typhoon-core/error";
import { DiscordRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { ForwardedDiscordAccessToken } from "@/middlewares/forwardedDiscordAccessToken/tag";
import { Discord } from "@/schema";
import { discordLayer as discordServiceLayer } from "@/services";

const DiscordMyGuild = Schema.Struct({
  id: Schema.String,
});

const formatError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : JSON.stringify(error);

const getForwardedDiscordAccessToken = Effect.fn("getForwardedDiscordAccessToken")(function* () {
  const accessToken = yield* ForwardedDiscordAccessToken;
  if (Option.isNone(accessToken)) {
    return yield* Effect.fail(makeArgumentError("Missing forwarded Discord access token"));
  }
  return accessToken.value;
});

export const discordLayer = DiscordRpcs.toLayer(
  Effect.gen(function* () {
    const guildsCache = yield* GuildsApiCacheView;
    const httpClient = yield* HttpClient.HttpClient;

    const getDiscordJson = Effect.fn("getDiscordJson")(function* (
      url: string,
      accessToken: Redacted.Redacted<string>,
      failureMessage: string,
    ) {
      const response = yield* httpClient
        .get(url, {
          headers: {
            Authorization: `Bearer ${Redacted.value(accessToken)}`,
          },
        })
        .pipe(
          Effect.mapError((error) => makeArgumentError(`${failureMessage}: ${formatError(error)}`)),
        );
      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.fail(makeArgumentError(`${failureMessage}: ${response.status}`));
      }

      return yield* response.json.pipe(
        Effect.mapError((error) =>
          makeArgumentError(`Failed to parse Discord response: ${formatError(error)}`),
        ),
      );
    });

    return {
      "discord.getCurrentUser": Effect.fnUntraced(function* () {
        const accessToken = yield* getForwardedDiscordAccessToken();
        const json = yield* getDiscordJson(
          "https://discord.com/api/v10/users/@me",
          accessToken,
          "Failed to fetch Discord user",
        );

        return yield* Schema.decodeUnknownEffect(Discord.DiscordUser)(json).pipe(
          Effect.mapError((error) =>
            makeArgumentError(`Invalid response from Discord API: ${String(error)}`),
          ),
        );
      }),
      "discord.getCurrentUserGuilds": Effect.fnUntraced(function* () {
        const accessToken = yield* getForwardedDiscordAccessToken();
        const json = yield* getDiscordJson(
          "https://discord.com/api/v10/users/@me/guilds",
          accessToken,
          "Failed to fetch Discord guilds",
        );

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
    };
  }),
).pipe(Layer.provide([discordServiceLayer]));
