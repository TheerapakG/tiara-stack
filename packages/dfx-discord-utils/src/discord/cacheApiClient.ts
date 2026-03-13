import { HttpApiClient, HttpClient } from "@effect/platform";
import { Context, Effect, Layer, pipe } from "effect";
import { DiscordCacheApi } from "./api";

// Helper to create the cache API client effect
const makeCacheApiClient = (baseUrl: string) =>
  pipe(
    Effect.all({
      httpClient: HttpClient.HttpClient,
    }),
    Effect.bind("client", ({ httpClient }) =>
      HttpApiClient.makeWith(DiscordCacheApi, {
        httpClient,
        baseUrl,
      }),
    ),
    Effect.map(({ client }) => client),
  );

// Export the client type
export type CacheApiClientType = Effect.Effect.Success<ReturnType<typeof makeCacheApiClient>>;

// Tag for dependency injection
export class CacheApiClient extends Context.Tag("CacheApiClient")<
  CacheApiClient,
  CacheApiClientType
>() {
  // Live layer - requires explicit base URL configuration
  static Live = (baseUrl: string) => Layer.effect(CacheApiClient, makeCacheApiClient(baseUrl));
}
