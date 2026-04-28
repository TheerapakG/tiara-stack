import { Headers, HttpClient } from "effect/unstable/http";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/unstable/rpc";
import { Context, Effect, Layer } from "effect";
import { DiscordRpcs as SheetBotRpcs } from "dfx-discord-utils/discord/rpc";
import { SheetBotRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotRpcAuthorization/tag";
import { config } from "@/config";
import { SheetApisRpcTokens } from "./sheetApisRpcTokens";

const AuthorizedSheetBotRpcs = SheetBotRpcs.middleware(SheetBotRpcAuthorization);

const getSheetBotRpcHeaders = Effect.fn("SheetBotRpcClient.getSheetBotRpcHeaders")(function* () {
  const tokens = yield* SheetApisRpcTokens;
  const sheetBotToken = yield* tokens.getSheetBotToken();

  return Headers.set(Headers.empty, "x-sheet-ingress-auth", `Bearer ${sheetBotToken}`);
});

const sheetBotRpcAuthorizationClientLayer = RpcMiddleware.layerClient(
  SheetBotRpcAuthorization,
  Effect.fn("SheetBotRpcClient.SheetBotRpcAuthorizationClient")(function* ({ request, next }) {
    const headers = yield* getSheetBotRpcHeaders();
    return yield* next({
      ...request,
      headers: Headers.merge(request.headers, headers),
    });
  }),
);

export class SheetBotRpcClient extends Context.Service<SheetBotRpcClient>()("SheetBotRpcClient", {
  make: Effect.gen(function* () {
    const baseUrl = yield* config.sheetBotBaseUrl;
    const httpClient = yield* HttpClient.HttpClient;
    const rpcUrl = `${baseUrl.replace(/\/$/, "")}/rpc`;

    return yield* RpcClient.make(AuthorizedSheetBotRpcs).pipe(
      Effect.provide(RpcClient.layerProtocolHttp({ url: rpcUrl })),
      Effect.provide(sheetBotRpcAuthorizationClientLayer),
      Effect.provide(RpcSerialization.layerJson),
      Effect.provideService(HttpClient.HttpClient, httpClient),
    );
  }),
}) {
  static layer = Layer.effect(SheetBotRpcClient, this.make);
}
