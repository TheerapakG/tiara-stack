import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiSwagger } from "effect/unstable/httpapi";
import { NodeHttpServer } from "@effect/platform-node";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DiscordApi, discordApiLayer as baseDiscordApiLayer } from "dfx-discord-utils/discord";
import { Layer } from "effect";
import { createServer } from "http";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";

const discordApiLayer = baseDiscordApiLayer.pipe(Layer.provide([discordConfigLayer, cachesLayer]));

const apiLayer = Layer.provide(HttpApiBuilder.layer(DiscordApi), discordApiLayer).pipe(
  Layer.merge(HttpApiSwagger.layer(DiscordApi)),
);

export const httpLayer = HttpRouter.serve(apiLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
