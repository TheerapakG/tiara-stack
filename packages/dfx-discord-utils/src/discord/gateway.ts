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
import { Effect, Layer } from "effect";

export const DiscordLayer = DiscordIxLive.pipe(
  Layer.provide(NodeHttpClient.layer),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
);

const DiscordApplicationBase = Effect.Service<Discord.PrivateApplicationResponse>()(
  "DiscordApplication",
  {
    effect: DiscordREST.pipe(
      Effect.flatMap((_) => _.getMyApplication()),
      Effect.orDie,
    ),
    dependencies: [DiscordLayer] as const,
  },
);

export class DiscordApplication extends DiscordApplicationBase {}

export const DiscordGatewayLayerLive: Layer.Layer<
  | DiscordGatewayService
  | DiscordRESTService
  | InteractionsRegistryService
  | RateLimiterService
  | Discord.PrivateApplicationResponse,
  never,
  DiscordConfig.DiscordConfig
> = Layer.merge(DiscordLayer, DiscordApplication.Default);

export const DiscordGatewayLayer = DiscordGatewayLayerLive;
