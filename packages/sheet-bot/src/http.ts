import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { NodeHttpServer } from "@effect/platform-node";
import {
  DiscordApplication,
  DiscordLayer,
  discordRpcHandlersLayer,
} from "dfx-discord-utils/discord";
import { SheetBotRpcs } from "sheet-ingress-api/sheet-bot-rpc";
import { Layer } from "effect";
import { createServer } from "http";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";
import { SheetBotRpcAuthorizationLive } from "./middlewares/discordRpcAuthorization/live";

const rpcHandlersLayer = discordRpcHandlersLayer.pipe(
  Layer.provide(DiscordApplication.restLayer),
  Layer.provide(DiscordLayer),
  Layer.provide([discordConfigLayer, cachesLayer]),
);

const rpcRoutesLayer = RpcServer.layerHttp({
  group: SheetBotRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(SheetBotRpcAuthorizationLive),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provideMerge(HttpRouter.layer),
);

export const httpLayer = HttpRouter.serve(rpcRoutesLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
