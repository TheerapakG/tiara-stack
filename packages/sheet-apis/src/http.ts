import { NodeHttpServer } from "@effect/platform-node";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi";
import { Layer } from "effect";
import { createServer } from "http";
import { SheetApisApi } from "sheet-ingress-api/sheet-apis";
import { calcLayer } from "./handlers/calc";
import { checkinLayer } from "./handlers/checkin";
import { discordLayer } from "./handlers/discord";
import { guildConfigLayer } from "./handlers/guildConfig";
import { healthLayer } from "./handlers/health";
import { messageCheckinLayer } from "./handlers/messageCheckin";
import { messageRoomOrderLayer } from "./handlers/messageRoomOrder";
import { messageSlotLayer } from "./handlers/messageSlot";
import { monitorLayer } from "./handlers/monitor";
import { permissionsLayer } from "./handlers/permissions";
import { playerLayer } from "./handlers/player";
import { roomOrderLayer } from "./handlers/roomOrder";
import { scheduleLayer } from "./handlers/schedule";
import { screenshotLayer } from "./handlers/screenshot";
import { sheetLayer } from "./handlers/sheet";
import { discordLayer as discordServiceLayer } from "./services/discord";

const ApiLayer = Layer.provide(HttpApiBuilder.layer(SheetApisApi), [
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
]).pipe(Layer.merge(HttpApiSwagger.layer(SheetApisApi)));

export const httpLayer = HttpRouter.serve(ApiLayer).pipe(
  Layer.provide(discordServiceLayer),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
