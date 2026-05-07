import { config } from "@/config";
import { Interaction } from "dfx-discord-utils";
import { DiscordInteraction } from "dfx/Interactions/context";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import {
  Cache,
  Data,
  Duration,
  Effect,
  Exit,
  FileSystem,
  Ref,
  Match,
  pipe,
  Schedule,
  DateTime,
  Layer,
  Option,
  Redacted,
  Context,
} from "effect";
import { createKubernetesOAuthSession } from "sheet-auth/client";
import { DISCORD_SERVICE_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetClusterApi } from "sheet-ingress-api/sheet-cluster";
import { SheetAuthClient } from "./sheetAuthClient";

type SheetClusterRequester = Data.TaggedEnum<{
  Service: {};
  DiscordUser: { readonly discordUserId: string };
}>;
const SheetClusterRequester = Data.taggedEnum<SheetClusterRequester>();

type SheetClusterRequestContextType = {
  requester: SheetClusterRequester;
};

type TokenCacheEntry = {
  token: Redacted.Redacted<string> | undefined;
  timeToLive: Duration.Duration;
  failed: boolean;
};

const sheetClusterRequestContextTag = Context.Reference<SheetClusterRequestContextType>(
  "SheetClusterRequestContext",
  {
    defaultValue: () => ({
      requester: SheetClusterRequester.Service(),
    }),
  },
) as Context.Reference<SheetClusterRequestContextType> & {
  readonly Type: SheetClusterRequestContextType;
};

type SheetClusterRequestContextTag = typeof sheetClusterRequestContextTag;

export const SheetClusterRequestContext = Object.assign(sheetClusterRequestContextTag, {
  asService: <Args extends any[], A, E, R>(fn: (...args: Args) => Effect.Effect<A, E, R>) =>
    Effect.fn("SheetClusterRequestContext.asService")(function* (...args: Args) {
      const sheetClusterRequestContext: SheetClusterRequestContextType = {
        requester: SheetClusterRequester.Service(),
      };

      return yield* fn(...args).pipe(
        Effect.provideService(sheetClusterRequestContextTag, sheetClusterRequestContext),
      );
    }),

  asInteractionUser: <Args extends any[], A, E, R>(fn: (...args: Args) => Effect.Effect<A, E, R>) =>
    Effect.fn("SheetClusterRequestContext.asInteractionUser")(function* (...args: Args) {
      const interactionUser = yield* Interaction.user();
      const sheetClusterRequestContext: SheetClusterRequestContextType = {
        requester: SheetClusterRequester.DiscordUser({
          discordUserId: (interactionUser as { id: string }).id,
        }),
      };

      return yield* fn(...args).pipe(
        Effect.provideService(sheetClusterRequestContextTag, sheetClusterRequestContext),
      );
    }),
}) as SheetClusterRequestContextTag & {
  asService: <Args extends any[], A, E, R>(
    fn: (...args: Args) => Effect.Effect<A, E, R>,
  ) => (...args: Args) => Effect.Effect<A, E, Exclude<R, SheetClusterRequestContextTag>>;
  asInteractionUser: <Args extends any[], A, E, R>(
    fn: (...args: Args) => Effect.Effect<A, E, R>,
  ) => (
    ...args: Args
  ) => Effect.Effect<A, E, DiscordInteraction | Exclude<R, SheetClusterRequestContextTag>>;
};

export class SheetClusterClient extends Context.Service<SheetClusterClient>()(
  "SheetClusterClient",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const sheetAuthClient = yield* SheetAuthClient;
      const httpClient = yield* HttpClient.HttpClient;
      const k8sTokenRef = yield* Ref.make("");
      const baseUrl = yield* config.sheetIngressBaseUrl;

      yield* pipe(
        fs.readFileString("/var/run/secrets/tokens/sheet-auth-token", "utf-8"),
        Effect.map((token) => token.trim()),
        Effect.flatMap((token) => Ref.set(k8sTokenRef, token)),
        Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
        Effect.catch(() => Effect.void),
        Effect.repeat(Schedule.spaced("5 minutes")),
        Effect.forkScoped,
      );

      const tokenCache = yield* Cache.makeWith<string, TokenCacheEntry>(
        Effect.fn("SheetClusterClient.lookup")(function* (discordUserId: string) {
          const k8sToken = yield* Ref.get(k8sTokenRef);
          const session = yield* createKubernetesOAuthSession(
            sheetAuthClient,
            discordUserId,
            k8sToken,
          ).pipe(Effect.catch(() => Effect.succeed(undefined)));
          const now = yield* DateTime.now;
          const timeToLive = session?.session?.expiresAt
            ? pipe(
                DateTime.distance(now, session.session.expiresAt),
                Duration.subtract(Duration.seconds(60)),
              )
            : Duration.minutes(1);

          return {
            token: session?.token,
            timeToLive,
            failed: session === undefined,
          };
        }),
        {
          capacity: Infinity,
          timeToLive: Exit.match({
            onFailure: () => Duration.minutes(1),
            onSuccess: ({ timeToLive }) => timeToLive,
          }),
        },
      );

      const httpClientWithToken = HttpClient.mapRequestEffect(
        httpClient,
        Effect.fnUntraced(function* (request) {
          const { requester } = yield* Effect.serviceOption(sheetClusterRequestContextTag).pipe(
            Effect.map(
              Option.getOrElse(
                (): SheetClusterRequestContextType => ({
                  requester: SheetClusterRequester.Service(),
                }),
              ),
            ),
          );
          const cacheKey = Match.value(requester).pipe(
            Match.tagsExhaustive({
              Service: () => DISCORD_SERVICE_USER_ID_SENTINEL,
              DiscordUser: (requester) => requester.discordUserId,
            }),
          );
          const { token, failed } = yield* Match.value(requester).pipe(
            Match.tagsExhaustive({
              Service: () =>
                pipe(
                  Cache.get(tokenCache, cacheKey),
                  Effect.catch((err) =>
                    pipe(
                      Effect.logWarning(
                        `Failed to get service auth token, proceeding unauthenticated: ${String(err)}`,
                      ),
                      Effect.as({
                        token: undefined,
                        timeToLive: Duration.minutes(1),
                        failed: true,
                      }),
                    ),
                  ),
                ),
              DiscordUser: () => Cache.get(tokenCache, cacheKey),
            }),
          );

          if (requester._tag === "DiscordUser" && (token === undefined || failed)) {
            return yield* Effect.fail(
              new Error("Failed to get Discord user auth token for sheet cluster request"),
            );
          }

          return token ? HttpClientRequest.bearerToken(request, Redacted.value(token)) : request;
        }),
      ) as unknown as HttpClient.HttpClient;

      const client = yield* HttpApiClient.makeWith(SheetClusterApi, {
        httpClient: httpClientWithToken,
        baseUrl,
      });

      return {
        get: () => client,
      };
    }),
  },
) {
  static layer = Layer.effect(SheetClusterClient, this.make).pipe(
    Layer.provide(SheetAuthClient.layer),
  );
}
