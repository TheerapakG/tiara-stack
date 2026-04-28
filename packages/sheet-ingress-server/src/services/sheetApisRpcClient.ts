import { Headers, HttpClient } from "effect/unstable/http";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/unstable/rpc";
import { Array, Context, Effect, Layer, Option, pipe, Redacted } from "effect";
import { SheetApisRpcAuthorization } from "sheet-ingress-api/middlewares/sheetApisRpcAuthorization/tag";
import { SheetApisRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import { config } from "@/config";
import { SheetApisRpcTokens } from "./sheetApisRpcTokens";

const makeSheetApisRpcAuthorizationClientLayer = <R>(
  getHeaders: () => Effect.Effect<Headers.Headers, Unauthorized, R>,
) =>
  RpcMiddleware.layerClient(
    SheetApisRpcAuthorization,
    Effect.fn("SheetApisRpcClient.SheetApisRpcAuthorizationClient")(function* ({ request, next }) {
      const headers = yield* getHeaders();
      return yield* next({
        ...request,
        headers: Headers.merge(request.headers, headers),
      });
    }),
  );

export const getRpcHeaders = Effect.fn("SheetApisRpcClient.getRpcHeaders")(function* () {
  const tokens = yield* SheetApisRpcTokens;
  const user = yield* SheetAuthUser;
  const sheetApisToken = yield* tokens.getSheetApisToken();
  let headers = pipe(
    Headers.set(Headers.empty, "x-sheet-ingress-auth", `Bearer ${sheetApisToken}`),
    Headers.set("x-sheet-auth-user-id", user.userId),
    Headers.set("x-sheet-auth-account-id", user.accountId),
    Headers.set("x-sheet-auth-permissions", Array.fromIterable(user.permissions).join(",")),
  );

  const maybeDiscordAccessToken = yield* tokens.getOptionalDiscordAccessToken(user);
  if (Option.isSome(maybeDiscordAccessToken)) {
    headers = Headers.set(
      headers,
      "x-sheet-discord-access-token",
      Redacted.value(maybeDiscordAccessToken.value),
    );
  }

  return headers;
});

export class SheetApisRpcClient extends Context.Service<SheetApisRpcClient>()(
  "SheetApisRpcClient",
  {
    make: Effect.gen(function* () {
      const baseUrl = yield* config.sheetApisBaseUrl;
      const httpClient = yield* HttpClient.HttpClient;
      const rpcUrl = `${baseUrl.replace(/\/$/, "")}/rpc`;

      return yield* RpcClient.make(SheetApisRpcs).pipe(
        Effect.provide(RpcClient.layerProtocolHttp({ url: rpcUrl })),
        Effect.provide(RpcSerialization.layerJson),
        Effect.provideService(HttpClient.HttpClient, httpClient),
      );
    }),
  },
) {
  static layer = Layer.effect(SheetApisRpcClient, this.make).pipe(
    Layer.provide(makeSheetApisRpcAuthorizationClientLayer(getRpcHeaders)),
    Layer.provide(SheetApisRpcTokens.layer),
  );
}
