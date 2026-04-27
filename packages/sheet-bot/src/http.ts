import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { NodeHttpServer } from "@effect/platform-node";
import {
  DiscordApplication,
  DiscordRpcs,
  discordRpcHandlersLayer,
} from "dfx-discord-utils/discord";
import { Layer } from "effect";
import { createServer } from "http";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";

const rpcHandlersLayer = discordRpcHandlersLayer.pipe(
  Layer.provide(DiscordApplication.layer),
  Layer.provide([discordConfigLayer, cachesLayer]),
);

const rpcRoutesLayer = RpcServer.layerHttp({
  group: DiscordRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provideMerge(HttpRouter.layer),
);

export const httpLayer = HttpRouter.serve(rpcRoutesLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
