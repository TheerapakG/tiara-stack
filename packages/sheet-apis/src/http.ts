import { NodeHttpServer } from "@effect/platform-node";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { createServer } from "http";
import { Api } from "./api";
import { config } from "./config";
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

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) {
      return true;
    }
    if (allowed.includes("*")) {
      const withPlaceholder = allowed.replace(/\*/g, "\x00");
      const escaped = withPlaceholder.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      // eslint-disable-next-line no-control-regex
      const regex = new RegExp(`^${escaped.replace(/\x00/g, "[^./]*")}$`);
      return regex.test(origin);
    }
    return false;
  });
}

// Debug middleware to log scope information
let requestId = 0;
const debugScopeMiddleware = HttpRouter.middleware((effect) =>
  Effect.gen(function* () {
    const reqNum = ++requestId;
    const scope = yield* Effect.scope;
    console.log(`[Request #${reqNum}] Scope object:`, scope);
    console.log(`[Request #${reqNum}] Scope state:`, (scope as any).state);
    return yield* effect;
  }),
).layer;

const corsMiddlewareLayer = Layer.unwrap(
  Effect.gen(function* () {
    const trustedOrigins = [...(yield* config.trustedOrigins)];
    return HttpRouter.middleware(
      HttpMiddleware.cors({
        allowedOrigins: (origin) => isOriginAllowed(origin, trustedOrigins),
        allowedHeaders: ["Content-Type", "Authorization", "b3", "traceparent", "tracestate"],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
        exposedHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
      }),
    ).layer;
  }),
);

const ApiLayer = Layer.provide(HttpApiBuilder.layer(Api), [
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
]).pipe(
  Layer.merge(HttpApiSwagger.layer(Api)),
  Layer.provide([corsMiddlewareLayer, debugScopeMiddleware]),
);

export const httpLayer = HttpRouter.serve(ApiLayer).pipe(
  Layer.provide(discordServiceLayer),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
