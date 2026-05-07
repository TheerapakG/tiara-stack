import { HttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Context, Effect, Layer } from "effect";
import { SheetApisRpcAuthorization } from "sheet-ingress-api/middlewares/sheetApisRpcAuthorization/tag";
import { SheetClusterRpcs } from "sheet-ingress-api/sheet-cluster-rpc";
import { config } from "@/config";
import { makeIngressRpcHeadersClientLayer } from "./rpcAuthorizationClient";
import { SheetApisRpcTokens } from "./sheetApisRpcTokens";

const sheetClusterTokenPath = "/var/run/secrets/tokens/sheet-cluster-token";

export class SheetClusterRpcClient extends Context.Service<SheetClusterRpcClient>()(
  "SheetClusterRpcClient",
  {
    make: Effect.gen(function* () {
      const baseUrl = yield* config.sheetClusterBaseUrl;
      const httpClient = yield* HttpClient.HttpClient;
      const rpcUrl = `${baseUrl.replace(/\/$/, "")}/rpc`;

      return yield* RpcClient.make(SheetClusterRpcs).pipe(
        Effect.provide(RpcClient.layerProtocolHttp({ url: rpcUrl })),
        Effect.provide(RpcSerialization.layerJson),
        Effect.provideService(HttpClient.HttpClient, httpClient),
      );
    }),
  },
) {
  static layer = Layer.effect(SheetClusterRpcClient, this.make).pipe(
    Layer.provide(
      makeIngressRpcHeadersClientLayer(
        SheetApisRpcAuthorization,
        "SheetClusterRpcClient.SheetApisRpcAuthorizationClient",
        { serviceTokenPath: sheetClusterTokenPath },
      ),
    ),
    Layer.provide(SheetApisRpcTokens.layer),
  );
}
