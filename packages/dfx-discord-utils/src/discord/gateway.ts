import { NodeHttpClient } from "@effect/platform-node";
import { NodeSocket } from "@effect/platform-node";
import { Discord, DiscordREST } from "dfx";
import { DiscordIxLive } from "dfx/gateway";
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
    dependencies: [DiscordLayer],
  },
);

export class DiscordApplication extends DiscordApplicationBase {}

export const DiscordGatewayLayer = Layer.merge(DiscordLayer, DiscordApplication.Default);
