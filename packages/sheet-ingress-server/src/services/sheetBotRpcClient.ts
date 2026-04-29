import { HttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Context, Effect, Layer } from "effect";
import { DiscordRpcs as SheetBotRpcs } from "dfx-discord-utils/discord/rpc";
import { SheetBotRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotRpcAuthorization/tag";
import { config } from "@/config";
import { makeIngressRpcHeadersClientLayer } from "./rpcAuthorizationClient";

const AuthorizedSheetBotRpcs = SheetBotRpcs.middleware(SheetBotRpcAuthorization);
const sheetBotTokenPath = "/var/run/secrets/tokens/sheet-bot-token";

const sheetBotRpcAuthorizationClientLayer = makeIngressRpcHeadersClientLayer(
  SheetBotRpcAuthorization,
  "SheetBotRpcClient.SheetBotRpcAuthorizationClient",
  { serviceTokenPath: sheetBotTokenPath },
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
