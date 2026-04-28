import { NodeHttpServer } from "@effect/platform-node";
import { HttpClient, HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import type { ServeError } from "effect/unstable/http/HttpServerError";
import { RpcSerialization, RpcServer, type Rpc, type RpcGroup } from "effect/unstable/rpc";
import { Layer } from "effect";
import type { ConfigError } from "effect/Config";
import { createServer } from "http";
import { SheetApisRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { GoogleSheetsError } from "sheet-ingress-api/schemas/google";
import { calcLayer } from "./handlers/calc";
import { checkinLayer } from "./handlers/checkin";
import { discordLayer } from "./handlers/discord";
import { guildConfigLayer } from "./handlers/guildConfig";
import { healthLayer } from "./handlers/health";
import { messageCheckinLayer } from "./handlers/messageCheckin";
import { messageRoomOrderLayer } from "./handlers/messageRoomOrder";
import { messageSlotLayer } from "./handlers/messageSlot";
import { monitorLayer } from "./handlers/monitor";
import { SheetAuthTokenAuthorizationLive } from "./middlewares/sheetAuthTokenAuthorization/live";
import { permissionsLayer } from "./handlers/permissions";
import { playerLayer } from "./handlers/player";
import { roomOrderLayer } from "./handlers/roomOrder";
import { scheduleLayer } from "./handlers/schedule";
import { screenshotLayer } from "./handlers/screenshot";
import { sheetLayer } from "./handlers/sheet";
import { discordLayer as discordServiceLayer } from "./services/discord";

type SheetApisRpcHandlers = Rpc.ToHandler<RpcGroup.Rpcs<typeof SheetApisRpcs>>;

const rpcHandlersLayer: Layer.Layer<
  SheetApisRpcHandlers,
  ConfigError | GoogleSheetsError,
  HttpClient.HttpClient
> = Layer.mergeAll(
  calcLayer,
  checkinLayer,
  healthLayer,
  guildConfigLayer,
  messageCheckinLayer,
  messageRoomOrderLayer,
  messageSlotLayer,
  permissionsLayer,
  sheetLayer,
  monitorLayer,
  playerLayer,
  roomOrderLayer,
  screenshotLayer,
  scheduleLayer,
  discordLayer,
);

const rpcRoutesLayer = RpcServer.layerHttp({
  group: SheetApisRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(SheetAuthTokenAuthorizationLive),
  Layer.provide(RpcSerialization.layerJson),
  Layer.merge(HttpRouter.add("GET", "/live", HttpServerResponse.empty({ status: 200 }))),
  Layer.merge(HttpRouter.add("GET", "/ready", HttpServerResponse.empty({ status: 200 }))),
  Layer.provideMerge(HttpRouter.layer),
);

export const httpLayer: Layer.Layer<
  HttpRouter.HttpRouter,
  ConfigError | GoogleSheetsError | ServeError,
  HttpClient.HttpClient
> = HttpRouter.serve(rpcRoutesLayer).pipe(
  Layer.provide(discordServiceLayer),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
