import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { NodeHttpServer } from "@effect/platform-node";
import { DiscordApplication, discordRpcHandlersLayer } from "dfx-discord-utils/discord";
import { Layer } from "effect";
import { createServer } from "http";
import { SheetBotRpcAuthorization, SheetBotRpcs } from "sheet-ingress-api/sheet-bot";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";
import { SheetBotRpcAuthorizationLive } from "./middlewares/discordRpcAuthorization/live";

const AuthorizedSheetBotRpcs = SheetBotRpcs.middleware(SheetBotRpcAuthorization);

const rpcHandlersLayer = discordRpcHandlersLayer.pipe(
  Layer.provide(DiscordApplication.layer),
  Layer.provide([discordConfigLayer, cachesLayer]),
);

const rpcRoutesLayer = RpcServer.layerHttp({
  group: AuthorizedSheetBotRpcs,
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
