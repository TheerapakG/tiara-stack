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
  pipe,
  Redacted,
  Ref,
  Schedule,
} from "effect";
import { createKubernetesOAuthSession } from "sheet-auth/client";
import { DISCORD_SERVICE_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { SheetAuthClient } from "./sheetAuthClient";

const sheetAuthTokenPath = "/var/run/secrets/tokens/sheet-auth-token";

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

      const serviceTokenRefs = yield* Cache.makeWith(
        Effect.fn("SheetApisRpcTokens.lookupServiceTokenRef")(function* (tokenPath) {
          const tokenRef = yield* Ref.make("");
          const refreshServiceToken = refreshToken(tokenPath, tokenPath, tokenRef);

          yield* refreshServiceToken.pipe(
            Effect.tapError((error) =>
              Effect.logError(`Failed to initialize Kubernetes token at ${tokenPath}`, error),
            ),
          );
          yield* refreshServiceToken.pipe(
            Effect.catch((error) =>
              Effect.logWarning(`Failed to refresh Kubernetes token at ${tokenPath}`, error),
            ),
            Effect.repeat(Schedule.spaced("5 minutes")),
            Effect.forkScoped,
          );

          return tokenRef;
        }),
        {
          capacity: 16,
          timeToLive: Exit.match({
            onFailure: () => Duration.seconds(30),
            onSuccess: () => Duration.infinity,
          }),
        },
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
        getServiceToken: Effect.fn("SheetApisRpcTokens.getServiceToken")(function* (
          tokenPath: string,
        ) {
          const tokenRef = yield* Cache.get(serviceTokenRefs, tokenPath);
          return yield* Ref.get(tokenRef);
        }),
        getServiceUser,
        withServiceUser: Effect.fn("SheetApisRpcTokens.withServiceUser")(function* <A, E, R>(
          effect: Effect.Effect<A, E, R>,
        ) {
          const serviceUser = yield* getServiceUser();
          return yield* effect.pipe(Effect.provideService(SheetAuthUser, serviceUser));
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(SheetApisRpcTokens, this.make).pipe(
    Layer.provide([SheetAuthClient.layer, NodeFileSystem.layer]),
  );
}
