import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { apiCacheViewsLayer, Unstorage } from "dfx-discord-utils/discord/cache";
import { DiscordApiClient } from "dfx-discord-utils/discord";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import {
  Cache,
  DateTime,
  Duration,
  Effect,
  Exit,
  FileSystem,
  Layer,
  pipe,
  Redacted,
  Ref,
  Schedule,
} from "effect";
import { createKubernetesOAuthSession } from "sheet-auth/client";
import { DISCORD_SERVICE_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { config } from "@/config";
import { SheetAuthClient } from "./sheetAuthClient";

type TokenCacheEntry = {
  readonly token: Redacted.Redacted<string> | undefined;
  readonly timeToLive: Duration.Duration;
};

const sheetAuthTokenPath = "/var/run/secrets/tokens/sheet-auth-token";

const serviceUserAuthHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const sheetAuthClient = yield* SheetAuthClient;
    const httpClient = yield* HttpClient.HttpClient;
    const k8sTokenRef = yield* Ref.make("");

    const refreshK8sToken = pipe(
      fs.readFileString(sheetAuthTokenPath, "utf-8"),
      Effect.map((token) => token.trim()),
      Effect.flatMap((token) => Ref.set(k8sTokenRef, token)),
      Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
      Effect.catch((error) =>
        Effect.logWarning("Failed to read sheet-auth Kubernetes token", error),
      ),
    );

    yield* refreshK8sToken;
    yield* refreshK8sToken.pipe(Effect.repeat(Schedule.spaced("5 minutes")), Effect.forkScoped);

    const tokenCache = yield* Cache.makeWith<string, TokenCacheEntry>(
      Effect.fn("DiscordApiClient.lookupServiceToken")(function* () {
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

    return HttpClient.mapRequestEffect(
      httpClient,
      Effect.fnUntraced(function* (request) {
        const { token } = yield* Cache.get(tokenCache, DISCORD_SERVICE_USER_ID_SENTINEL);

        return token ? HttpClientRequest.bearerToken(request, Redacted.value(token)) : request;
      }),
    ) as unknown as HttpClient.HttpClient;
  }),
).pipe(Layer.provide([SheetAuthClient.layer, NodeFileSystem.layer]));

const discordApiClientLayer = Layer.unwrap(
  Effect.gen(function* () {
    const sheetIngressBaseUrl = yield* config.sheetIngressBaseUrl;
    return DiscordApiClient.layer(sheetIngressBaseUrl).pipe(
      Layer.provide(serviceUserAuthHttpClientLayer),
    );
  }),
);

const redisLayer = Layer.unwrap(
  Effect.gen(function* () {
    const redisUrl = yield* config.redisUrl;
    return Unstorage.redisLayer({ url: Redacted.value(redisUrl) });
  }),
);

const prefixedUnstorageLayer = Unstorage.prefixedLayer("discord:").pipe(Layer.provide(redisLayer));

export const discordLayer = apiCacheViewsLayer.pipe(
  Layer.provideMerge(discordApiClientLayer),
  Layer.provide([prefixedUnstorageLayer, NodeHttpClient.layerFetch]),
);
