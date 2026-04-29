import { Cache, Context, Duration, Effect, Exit, Layer, Redacted } from "effect";
import { getDiscordAccessToken } from "sheet-auth/client";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { makeArgumentError } from "typhoon-core/error";
import { SheetAuthClient } from "./sheetAuthClient";

export const SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE = "ingress-forwarded-token-unavailable";

const isUnavailableSessionToken = (token: Redacted.Redacted<string>) =>
  Redacted.value(token) === SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE;

export class DiscordAccessTokenService extends Context.Service<DiscordAccessTokenService>()(
  "DiscordAccessTokenService",
  {
    make: Effect.gen(function* () {
      const sheetAuthClient = yield* SheetAuthClient;
      const accessTokenCache = yield* Cache.makeWith(
        (sessionToken: Redacted.Redacted<string>) =>
          getDiscordAccessToken(sheetAuthClient, {
            Authorization: `Bearer ${Redacted.value(sessionToken)}`,
          }).pipe(
            Effect.map(({ accessToken }) => accessToken),
            Effect.mapError((error) =>
              makeArgumentError("Failed to get Discord access token", error),
            ),
          ),
        {
          capacity: 10_000,
          timeToLive: Exit.match({
            onFailure: () => Duration.seconds(30),
            onSuccess: () => Duration.minutes(5),
          }),
        },
      );

      return {
        getCurrentUserDiscordAccessToken: Effect.fn(
          "DiscordAccessTokenService.getCurrentUserDiscordAccessToken",
        )(function* () {
          const user = yield* SheetAuthUser;

          if (isUnavailableSessionToken(user.token)) {
            return yield* Effect.fail(makeArgumentError("Missing sheet-auth session token"));
          }

          return yield* Cache.get(accessTokenCache, user.token);
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(DiscordAccessTokenService, this.make).pipe(
    Layer.provide(SheetAuthClient.layer),
  );
}
