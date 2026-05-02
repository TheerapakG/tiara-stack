import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { NodeHttpServer } from "@effect/platform-node";
import { DiscordApplication, discordRpcHandlersLayer } from "dfx-discord-utils/discord";
import { SheetBotDispatchRpcs, SheetBotRpcs } from "sheet-ingress-api/sheet-bot-rpc";
import type { SheetBotDispatchError } from "sheet-ingress-api/sheet-bot-rpc";
import { Effect, Layer } from "effect";
import { createServer } from "http";
import { makeUnknownError } from "typhoon-core/error";
import { cachesLayer } from "./discord/cache";
import { discordConfigLayer } from "./discord/config";
import {
  SheetBotDispatchRpcAuthorizationLive,
  SheetBotRpcAuthorizationLive,
} from "./middlewares/discordRpcAuthorization/live";
import { DispatchService } from "./services";

const knownDispatchErrorTags = new Set([
  "GoogleSheetsError",
  "ParserFieldError",
  "SheetConfigError",
  "SchemaError",
  "QueryResultAppError",
  "QueryResultParseError",
  "ArgumentError",
  "Unauthorized",
  "UnknownError",
]);

const normalizeDispatchError =
  (message: string): ((error: unknown) => SheetBotDispatchError) =>
  (error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      typeof error._tag === "string" &&
      knownDispatchErrorTags.has(error._tag)
    ) {
      return error as SheetBotDispatchError;
    }

    return makeUnknownError(message, error);
  };

const dispatchRpcHandlersLayer = SheetBotDispatchRpcs.toLayer({
  "dispatch.checkin": ({ payload }) =>
    Effect.gen(function* () {
      const dispatchService = yield* DispatchService;
      return yield* dispatchService.checkin(payload);
    }).pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch check-in"))),
  "dispatch.roomOrder": ({ payload }) =>
    Effect.gen(function* () {
      const dispatchService = yield* DispatchService;
      return yield* dispatchService.roomOrder(payload);
    }).pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch room order"))),
}).pipe(Layer.provide(DispatchService.layer));

const rpcHandlersLayer = Layer.merge(
  discordRpcHandlersLayer.pipe(
    Layer.provide(DiscordApplication.layer),
    Layer.provide([discordConfigLayer, cachesLayer]),
  ),
  dispatchRpcHandlersLayer,
);

const rpcRoutesLayer = RpcServer.layerHttp({
  group: SheetBotRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(SheetBotRpcAuthorizationLive),
  Layer.provide(SheetBotDispatchRpcAuthorizationLive),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provideMerge(HttpRouter.layer),
);

export const httpLayer = HttpRouter.serve(rpcRoutesLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
