import { NodeHttpClient } from "@effect/platform-node";
import { NodeSocket } from "@effect/platform-node";
import { DiscordREST } from "dfx";
import { DiscordIxLive } from "dfx/gateway";
import { Effect, Layer } from "effect";
import { DiscordConfigLayer } from "./config";

const DiscordLayer = DiscordIxLive.pipe(
  Layer.provide(NodeHttpClient.layer),
  Layer.provide(NodeSocket.layerWebSocketConstructor),
  Layer.provide(DiscordConfigLayer),
);

export class DiscordApplication extends Effect.Service<DiscordApplication>()("DiscordApplication", {
  effect: DiscordREST.pipe(
    Effect.flatMap((_) => _.getMyApplication()),
    Effect.orDie,
  ),
  dependencies: [DiscordLayer],
}) {}

export const DiscordGatewayLayer = Layer.merge(DiscordLayer, DiscordApplication.Default);
