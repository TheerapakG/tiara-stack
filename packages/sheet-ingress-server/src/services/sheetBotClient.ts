import { Context, Effect, Layer, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { SheetBotApi } from "sheet-ingress-api/sheet-bot";
import { config } from "@/config";
import { SheetApisClient } from "./sheetApisClient";

export class SheetBotClient extends Context.Service<SheetBotClient>()("SheetBotClient", {
  make: Effect.gen(function* () {
    const baseUrl = yield* config.sheetBotBaseUrl;
    const sheetApisClient = yield* SheetApisClient;
    const httpClient = yield* HttpClient.HttpClient;
    const httpClientWithServiceUser = HttpClient.mapRequestEffect(
      httpClient,
      Effect.fnUntraced(function* (request) {
        const serviceUser = yield* sheetApisClient.getServiceUser();
        return HttpClientRequest.bearerToken(request, Redacted.value(serviceUser.token));
      }),
    );

    return yield* HttpApiClient.makeWith(SheetBotApi, {
      baseUrl,
      httpClient: httpClientWithServiceUser,
    });
  }),
}) {
  static layer = Layer.effect(SheetBotClient, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
