import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiSwagger } from "effect/unstable/httpapi";
import { NodeHttpServer } from "@effect/platform-node";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { discordApiLayer as baseDiscordApiLayer } from "dfx-discord-utils/discord";
import { Layer } from "effect";
import { createServer } from "http";
import { SheetBotApi } from "sheet-ingress-api/sheet-bot";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";

const discordApiLayer = baseDiscordApiLayer.pipe(Layer.provide([discordConfigLayer, cachesLayer]));

const apiLayer = Layer.provide(HttpApiBuilder.layer(SheetBotApi), discordApiLayer).pipe(
  Layer.merge(HttpApiSwagger.layer(SheetBotApi)),
);

export const httpLayer = HttpRouter.serve(apiLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
