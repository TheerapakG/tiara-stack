import { HttpApiClient, HttpClient } from "@effect/platform";
import { Context, Effect, Layer, pipe } from "effect";
import { DiscordApi } from "./api";

// Helper to create the Discord API client effect
const makeDiscordApiClient = (baseUrl: string) =>
  pipe(
    Effect.all({
      httpClient: HttpClient.HttpClient,
    }),
    Effect.bind("client", ({ httpClient }) =>
      HttpApiClient.makeWith(DiscordApi, {
        httpClient,
        baseUrl,
      }),
    ),
    Effect.map(({ client }) => client),
  );

// Export the client type
export type DiscordApiClientType = Effect.Effect.Success<ReturnType<typeof makeDiscordApiClient>>;

// Tag for dependency injection
export class DiscordApiClient extends Context.Tag("DiscordApiClient")<
  DiscordApiClient,
  DiscordApiClientType
>() {
  // Live layer - requires explicit base URL configuration
  static Live = (baseUrl: string) => Layer.effect(DiscordApiClient, makeDiscordApiClient(baseUrl));
}
