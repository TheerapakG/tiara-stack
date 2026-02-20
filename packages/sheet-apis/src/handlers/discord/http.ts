import { HttpApiBuilder, HttpClient, HttpClientError } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, pipe, Schema } from "effect";
import { Api } from "@/api";
import { SheetAuthUser } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { DiscordGuild } from "./api";

export const DiscordLive = HttpApiBuilder.group(Api, "discord", (handlers) =>
  pipe(
    Effect.all({
      httpClient: HttpClient.HttpClient,
    }),
    Effect.map(({ httpClient }) =>
      handlers.handle("getCurrentUserGuilds", () =>
        Effect.gen(function* () {
          const sheetAuthUser = yield* SheetAuthUser;

          const accessToken = yield* Effect.fromNullable(sheetAuthUser.discordAccessToken).pipe(
            Effect.catchAll(() =>
              Effect.fail(
                makeArgumentError(
                  "Discord access token not available. Please authenticate with Discord.",
                ),
              ),
            ),
          );

          const response = yield* httpClient
            .get("https://discord.com/api/v10/users/@me/guilds", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            })
            .pipe(
              Effect.catchAll((error: HttpClientError.HttpClientError) =>
                Effect.fail(makeArgumentError(`Failed to fetch Discord guilds: ${error}`)),
              ),
            );

          const json = yield* response.json.pipe(
            Effect.catchAll((error: HttpClientError.HttpClientError) =>
              Effect.fail(makeArgumentError(`Failed to parse Discord response: ${error}`)),
            ),
          );

          const guilds = yield* Schema.decodeUnknown(Schema.Array(DiscordGuild))(json).pipe(
            Effect.catchAll((error) =>
              Effect.fail(makeArgumentError(`Invalid response from Discord API: ${error}`)),
            ),
          );

          return guilds;
        }),
      ),
    ),
  ),
).pipe(Layer.provide(SheetAuthTokenAuthorizationLive));
