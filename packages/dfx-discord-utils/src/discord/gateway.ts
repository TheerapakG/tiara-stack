import { NodeHttpClient } from "@effect/platform-node";
import { NodeSocket } from "@effect/platform-node";
import { Discord, DiscordConfig, DiscordREST } from "dfx";
import type { DiscordREST as DiscordRESTService } from "dfx/DiscordREST";
import type {
  InteractionsRegistry as InteractionsRegistryService,
  DiscordGateway as DiscordGatewayService,
} from "dfx/gateway";
import { DiscordIxLive } from "dfx/gateway";
import type { RateLimiter as RateLimiterService } from "dfx/RateLimit";
import { Effect, Layer, ServiceMap } from "effect";
import { HttpClientError } from "effect/unstable/http";

export const DiscordLayer = DiscordIxLive.pipe(
  Layer.provide(NodeHttpClient.layerFetch),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
);

export class DiscordApplication extends ServiceMap.Service<DiscordApplication>()(
  "DiscordApplication",
  {
    make: Effect.gen(function* () {
      const discordREST = yield* DiscordREST;
      return yield* discordREST.getMyApplication();
    }),
  },
) {
  // Live layer - requires explicit base URL configuration
  static layer = Layer.effect(DiscordApplication, this.make).pipe(Layer.provide(DiscordLayer));
}

export const discordGatewayLayer: Layer.Layer<
  DiscordGatewayService | DiscordRESTService | InteractionsRegistryService | RateLimiterService,
  | Discord.DiscordRestError<"ErrorResponse", Discord.ErrorResponse>
  | Discord.DiscordRestError<"RatelimitedResponse", Discord.RatelimitedResponse>
  | HttpClientError.HttpClientError,
  DiscordConfig.DiscordConfig
> = Layer.merge(DiscordLayer, DiscordApplication.layer);
