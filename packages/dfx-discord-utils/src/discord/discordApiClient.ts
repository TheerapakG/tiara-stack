import { HttpApiClient } from "effect/unstable/httpapi";
import { Layer, ServiceMap } from "effect";
import { DiscordApi } from "./api";
import { HttpClient } from "effect/unstable/http";

// Tag for dependency injection
export class DiscordApiClient extends ServiceMap.Service<
  DiscordApiClient,
  HttpApiClient.ForApi<typeof DiscordApi>
>()("DiscordApiClient") {
  // Live layer - requires explicit base URL configuration
  static layer = (baseUrl: string): Layer.Layer<DiscordApiClient, never, HttpClient.HttpClient> =>
    Layer.effect(
      DiscordApiClient,
      HttpApiClient.make(DiscordApi, {
        baseUrl,
      }),
    );
}
