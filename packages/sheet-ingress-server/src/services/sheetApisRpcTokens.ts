import { NodeFileSystem } from "@effect/platform-node";
import {
  Cache,
  Context,
  DateTime,
  Duration,
  Effect,
  Exit,
  FileSystem,
  HashSet,
  Layer,
  Option,
  pipe,
  Redacted,
  Ref,
  Schedule,
} from "effect";
import { createKubernetesOAuthSession, getDiscordAccessToken } from "sheet-auth/client";
import { DISCORD_SERVICE_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import { SheetAuthClient } from "./sheetAuthClient";

const sheetAuthTokenPath = "/var/run/secrets/tokens/sheet-auth-token";
const sheetApisTokenPath = "/var/run/secrets/tokens/sheet-apis-token";
const sheetBotTokenPath = "/var/run/secrets/tokens/sheet-bot-token";

type SheetAuthUserType = Context.Service.Shape<typeof SheetAuthUser>;

type TokenCacheEntry = {
  readonly token: Redacted.Redacted<string> | undefined;
  readonly userId: string | undefined;
  readonly timeToLive: Duration.Duration;
};

export class SheetApisRpcTokens extends Context.Service<SheetApisRpcTokens>()(
  "SheetApisRpcTokens",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const sheetAuthClient = yield* SheetAuthClient;
      const k8sTokenRef = yield* Ref.make("");
      const sheetApisTokenRef = yield* Ref.make("");
      const sheetBotTokenRef = yield* Ref.make("");

      const refreshToken = (tokenPath: string, tokenName: string, tokenRef: Ref.Ref<string>) =>
        pipe(
          fs.readFileString(tokenPath, "utf-8"),
          Effect.map((token) => token.trim()),
          Effect.flatMap((token) =>
            token.length > 0
              ? Ref.set(tokenRef, token)
              : Effect.fail(new Error(`${tokenName} Kubernetes token file is empty`)),
          ),
          Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
        );

      const refreshK8sToken = refreshToken(sheetAuthTokenPath, "sheet-auth", k8sTokenRef);

      yield* refreshK8sToken.pipe(
        Effect.tapError((error) =>
          Effect.logError("Failed to initialize sheet-auth Kubernetes token", error),
        ),
      );
      yield* refreshK8sToken.pipe(
        Effect.catch((error) =>
          Effect.logWarning("Failed to refresh sheet-auth Kubernetes token", error),
        ),
        Effect.repeat(Schedule.spaced("5 minutes")),
        Effect.forkScoped,
      );

      const refreshSheetApisToken = refreshToken(
        sheetApisTokenPath,
        "sheet-apis",
        sheetApisTokenRef,
      );

      yield* refreshSheetApisToken.pipe(
        Effect.tapError((error) =>
          Effect.logError("Failed to initialize sheet-apis Kubernetes token", error),
        ),
      );
      yield* refreshSheetApisToken.pipe(
        Effect.catch((error) =>
          Effect.logWarning("Failed to refresh sheet-apis Kubernetes token", error),
        ),
        Effect.repeat(Schedule.spaced("5 minutes")),
        Effect.forkScoped,
      );

      const refreshSheetBotToken = refreshToken(sheetBotTokenPath, "sheet-bot", sheetBotTokenRef);

      yield* refreshSheetBotToken.pipe(
        Effect.tapError((error) =>
          Effect.logError("Failed to initialize sheet-bot Kubernetes token", error),
        ),
      );
      yield* refreshSheetBotToken.pipe(
        Effect.catch((error) =>
          Effect.logWarning("Failed to refresh sheet-bot Kubernetes token", error),
        ),
        Effect.repeat(Schedule.spaced("5 minutes")),
        Effect.forkScoped,
      );

      const serviceUserTokenCache = yield* Cache.makeWith<string, TokenCacheEntry>(
        Effect.fn("SheetApisRpcTokens.lookupServiceUserToken")(function* () {
          const k8sToken = yield* Ref.get(k8sTokenRef);
          const session = yield* createKubernetesOAuthSession(
            sheetAuthClient,
            DISCORD_SERVICE_USER_ID_SENTINEL,
            k8sToken,
          ).pipe(
            Effect.catch((error) =>
              Effect.logWarning("Failed to create service-user auth session", error).pipe(
                Effect.as(undefined),
              ),
            ),
          );
          const now = yield* DateTime.now;
          const timeToLive = session?.session?.expiresAt
            ? Duration.max(
                pipe(
                  DateTime.distance(now, session.session.expiresAt),
                  Duration.subtract(Duration.seconds(60)),
                ),
                Duration.seconds(15),
              )
            : Duration.minutes(1);

          return {
            token: session?.token,
            userId: session?.session?.userId,
            timeToLive,
          };
        }),
        {
          capacity: 1,
          timeToLive: Exit.match({
            onFailure: () => Duration.minutes(1),
            onSuccess: ({ timeToLive }) => timeToLive,
          }),
        },
      );

      const discordAccessTokenCache = yield* Cache.makeWith(
        (token: Redacted.Redacted<string>) =>
          getDiscordAccessToken(sheetAuthClient, {
            Authorization: `Bearer ${Redacted.value(token)}`,
          }).pipe(Effect.map(({ accessToken }) => accessToken)),
        {
          capacity: 10_000,
          timeToLive: Exit.match({
            onFailure: () => Duration.seconds(30),
            onSuccess: () => Duration.minutes(5),
          }),
        },
      );

      const getServiceUser = Effect.fn("SheetApisRpcTokens.getServiceUser")(function* () {
        const { token, userId } = yield* Cache.get(
          serviceUserTokenCache,
          DISCORD_SERVICE_USER_ID_SENTINEL,
        );

        if (!token || !userId) {
          return yield* Effect.fail(new Error("Failed to create service-user auth session"));
        }

        return {
          accountId: DISCORD_SERVICE_USER_ID_SENTINEL,
          userId,
          permissions: HashSet.fromIterable(["service"]),
          token,
        } satisfies SheetAuthUserType;
      });

      return {
        getSheetApisToken: Effect.fn("SheetApisRpcTokens.getSheetApisToken")(function* () {
          return yield* Ref.get(sheetApisTokenRef);
        }),
        getSheetBotToken: Effect.fn("SheetApisRpcTokens.getSheetBotToken")(function* () {
          return yield* Ref.get(sheetBotTokenRef);
        }),
        getServiceUser,
        withServiceUser: Effect.fn("SheetApisRpcTokens.withServiceUser")(function* <A, E, R>(
          effect: Effect.Effect<A, E, R>,
        ) {
          const serviceUser = yield* getServiceUser();
          return yield* effect.pipe(Effect.provideService(SheetAuthUser, serviceUser));
        }),
        getOptionalDiscordAccessToken: Effect.fn(
          "SheetApisRpcTokens.getOptionalDiscordAccessToken",
        )(function* (user: SheetAuthUserType) {
          if (HashSet.has(user.permissions, "service") || user.accountId === "anonymous") {
            return Option.none();
          }

          return yield* Cache.get(discordAccessTokenCache, user.token).pipe(
            Effect.map(Option.some),
            Effect.mapError(
              (cause) =>
                new Unauthorized({
                  message: "Failed to get Discord access token for forwarding",
                  cause,
                }),
            ),
          );
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(SheetApisRpcTokens, this.make).pipe(
    Layer.provide([SheetAuthClient.layer, NodeFileSystem.layer]),
  );
}
