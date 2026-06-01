import { NodeFileSystem, NodeHttpServer } from "@effect/platform-node";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DiscordApplication, DiscordLayer } from "dfx-discord-utils/discord";
import { DiscordApi } from "dfx-discord-utils/discord/api";
import { discordHttpApiHandlersLayer } from "dfx-discord-utils/discord/http";
import { Layer } from "effect";
import { createServer } from "http";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";
import { sheetBotHttpAuthorizationLayer } from "./middlewares/discordHttpAuthorization/live";

const discordHandlersLayer = discordHttpApiHandlersLayer.pipe(
  Layer.provide(DiscordApplication.restLayer),
  Layer.provide(DiscordLayer),
  Layer.provide(NodeFileSystem.layer),
  Layer.provide([discordConfigLayer, cachesLayer]),
);

const apiRoutesLayer = Layer.provide(HttpApiBuilder.layer(DiscordApi), [discordHandlersLayer]).pipe(
  Layer.provide(sheetBotHttpAuthorizationLayer),
  Layer.merge(HttpRouter.add("GET", "/live", HttpServerResponse.empty({ status: 200 }))),
  Layer.merge(HttpRouter.add("GET", "/ready", HttpServerResponse.empty({ status: 200 }))),
  Layer.provide(HttpRouter.layer),
);

export const httpLayer = HttpRouter.serve(apiRoutesLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
