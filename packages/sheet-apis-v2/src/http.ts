import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { createServer } from "http";
import { Api } from "./api";
import { CalcLive } from "./handlers/calc";
import { HealthLive } from "./handlers/health";
import { GuildConfigLive } from "./handlers/guildConfig";
import { MessageCheckinLive } from "./handlers/messageCheckin";
import { MessageRoomOrderLive } from "./handlers/messageRoomOrder";
import { MessageSlotLive } from "./handlers/messageSlot";
import { SheetLive } from "./handlers/sheet";
import { MonitorLive } from "./handlers/monitor";
import { PlayerLive } from "./handlers/player";
import { ScreenshotLive } from "./handlers/screenshot";
import { ScheduleLive } from "./handlers/schedule";
import { SheetConfigService } from "./services/sheetConfig";
import { GoogleLive } from "./services/google";

const ApiLive = Layer.provide(HttpApiBuilder.api(Api), [
  CalcLive,
  HealthLive,
  GuildConfigLive,
  MessageCheckinLive,
  MessageRoomOrderLive,
  MessageSlotLive,
  SheetLive,
  MonitorLive,
  PlayerLive,
  ScreenshotLive,
  ScheduleLive,
]);

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  Layer.provide(SheetConfigService.DefaultWithoutDependencies),
  Layer.provide(GoogleLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
