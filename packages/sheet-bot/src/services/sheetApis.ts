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
  ServiceMap,
} from "effect";
import { createKubernetesOAuthSession } from "sheet-auth/client";
import { DISCORD_BOT_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { Api } from "sheet-apis/api";
import { SheetAuthClient } from "./sheetAuthClient";

type SheetApisRequester = Data.TaggedEnum<{
  Bot: {};
  DiscordUser: { readonly discordUserId: string };
}>;
export const SheetApisRequester = Data.taggedEnum<SheetApisRequester>();

type SheetApisRequestContextType = {
  requester: SheetApisRequester;
};

type TokenCacheEntry = {
  token: Redacted.Redacted<string> | undefined;
  timeToLive: Duration.Duration;
};

const sheetApisRequestContextTag = ServiceMap.Reference<SheetApisRequestContextType>(
  "SheetApisRequestContext",
  {
    defaultValue: () => ({
      requester: SheetApisRequester.Bot(),
    }),
  },
) as ServiceMap.Reference<SheetApisRequestContextType> & {
  readonly Type: SheetApisRequestContextType;
};

type SheetApisRequestContextTag = typeof sheetApisRequestContextTag;

export const SheetApisRequestContext = Object.assign(sheetApisRequestContextTag, {
  asBot: <Args extends any[], A, E, R>(fn: (...args: Args) => Effect.Effect<A, E, R>) =>
    Effect.fn("SheetApisRequestContext.asBot")(function* (...args: Args) {
      const sheetApisRequestContext: SheetApisRequestContextType = {
        requester: SheetApisRequester.Bot(),
      };

      return yield* fn(...args).pipe(
        Effect.provideService(sheetApisRequestContextTag, sheetApisRequestContext),
      );
    }),

  asInteractionUser: <Args extends any[], A, E, R>(fn: (...args: Args) => Effect.Effect<A, E, R>) =>
    Effect.fn("SheetApisRequestContext.asInteractionUser")(function* (...args: Args) {
      const interactionUser = yield* Interaction.user();
      const sheetApisRequestContext: SheetApisRequestContextType = {
        requester: SheetApisRequester.DiscordUser({
          discordUserId: (interactionUser as { id: string }).id,
        }),
      };

      return yield* fn(...args).pipe(
        Effect.provideService(sheetApisRequestContextTag, sheetApisRequestContext),
      );
    }),
}) as SheetApisRequestContextTag & {
  asBot: <Args extends any[], A, E, R>(
    fn: (...args: Args) => Effect.Effect<A, E, R>,
  ) => (...args: Args) => Effect.Effect<A, E, Exclude<R, SheetApisRequestContextTag>>;
  asInteractionUser: <Args extends any[], A, E, R>(
    fn: (...args: Args) => Effect.Effect<A, E, R>,
  ) => (
    ...args: Args
  ) => Effect.Effect<A, E, DiscordInteraction | Exclude<R, SheetApisRequestContextTag>>;
};

export class SheetApisClient extends ServiceMap.Service<SheetApisClient>()("SheetApisClient", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const sheetAuthClient = yield* SheetAuthClient;
    const httpClient = yield* HttpClient.HttpClient;
    const k8sTokenRef = yield* Ref.make("");
    const baseUrl = yield* config.sheetApisBaseUrl;

    yield* pipe(
      fs.readFileString("/var/run/secrets/tokens/sheet-auth-token", "utf-8"),
      Effect.map((token) => token.trim()),
      Effect.flatMap((token) => Ref.set(k8sTokenRef, token)),
      Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
      Effect.catch(() => Effect.void),
      Effect.repeat(Schedule.spaced("5 minutes")),
      Effect.forkScoped,
    );

    const tokenCache = yield* Cache.makeWith<string, TokenCacheEntry>({
      capacity: Infinity,
      lookup: Effect.fn("SheetApisClient.lookup")(function* (discordUserId: string) {
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
        };
      }),
      timeToLive: Exit.match({
        onFailure: () => Duration.minutes(1),
        onSuccess: ({ timeToLive }) => timeToLive,
      }),
    });

    const httpClientWithToken = HttpClient.mapRequestEffect(
      httpClient,
      Effect.fnUntraced(function* (request) {
        const { requester } = yield* Effect.serviceOption(sheetApisRequestContextTag).pipe(
          Effect.map(
            Option.getOrElse(
              (): SheetApisRequestContextType => ({
                requester: SheetApisRequester.Bot(),
              }),
            ),
          ),
        );
        const cacheKey = Match.value(requester).pipe(
          Match.tagsExhaustive({
            Bot: () => DISCORD_BOT_USER_ID_SENTINEL,
            DiscordUser: (requester) => requester.discordUserId,
          }),
        );
        const { token } = yield* pipe(
          Cache.get(tokenCache, cacheKey),
          Effect.catch((err) =>
            pipe(
              Effect.logWarning(
                `Failed to get auth token, proceeding unauthenticated: ${String(err)}`,
              ),
              Effect.as({ token: undefined }),
            ),
          ),
        );

        return token ? HttpClientRequest.bearerToken(request, Redacted.value(token)) : request;
      }),
    ) as unknown as HttpClient.HttpClient;

    const client = yield* HttpApiClient.makeWith(Api, {
      httpClient: httpClientWithToken,
      baseUrl,
    });

    return {
      get: () => client,
    };
  }),
}) {
  static layer = Layer.effect(SheetApisClient, this.make).pipe(
    Layer.provide(SheetAuthClient.layer),
  );
}
