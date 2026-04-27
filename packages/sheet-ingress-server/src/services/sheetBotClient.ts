import { Context, Effect, Layer, Redacted } from "effect";
import { HttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { SheetBotRpcs } from "sheet-ingress-api/sheet-bot";
import { config } from "@/config";
import { SheetApisClient } from "./sheetApisClient";

export class SheetBotClient extends Context.Service<SheetBotClient>()("SheetBotClient", {
  make: Effect.gen(function* () {
    const baseUrl = yield* config.sheetBotBaseUrl;
    const sheetApisClient = yield* SheetApisClient;
    const httpClient = yield* HttpClient.HttpClient;
    const rpcUrl = `${baseUrl.replace(/\/$/, "")}/rpc`;

    const authenticatedHttpClient = HttpClient.mapRequestEffect(httpClient, (request) =>
      sheetApisClient.getServiceUser().pipe(
        Effect.map((serviceUser) =>
          HttpClientRequest.bearerToken(request, Redacted.value(serviceUser.token)),
        ),
        Effect.mapError(
          (cause) =>
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new Error("Failed to get sheet-bot service user", { cause }),
              }),
            }),
        ),
      ),
    );

    const rpcClient = yield* RpcClient.make(SheetBotRpcs).pipe(
      Effect.provide(RpcClient.layerProtocolHttp({ url: rpcUrl })),
      Effect.provide(RpcSerialization.layerJson),
      Effect.provideService(HttpClient.HttpClient, authenticatedHttpClient),
    );

    type RpcPayload<Tag extends keyof typeof rpcClient> = Parameters<(typeof rpcClient)[Tag]>[0];

    return {
      application: {
        getApplication: () => rpcClient["application.getApplication"](undefined),
      },
      cache: {
        getGuild: (args: RpcPayload<"cache.getGuild">) => rpcClient["cache.getGuild"](args),
        getGuildSize: () => rpcClient["cache.getGuildSize"](undefined),
        getChannel: (args: RpcPayload<"cache.getChannel">) => rpcClient["cache.getChannel"](args),
        getRole: (args: RpcPayload<"cache.getRole">) => rpcClient["cache.getRole"](args),
        getMember: (args: RpcPayload<"cache.getMember">) => rpcClient["cache.getMember"](args),
        getChannelsForParent: (args: RpcPayload<"cache.getChannelsForParent">) =>
          rpcClient["cache.getChannelsForParent"](args),
        getRolesForParent: (args: RpcPayload<"cache.getRolesForParent">) =>
          rpcClient["cache.getRolesForParent"](args),
        getMembersForParent: (args: RpcPayload<"cache.getMembersForParent">) =>
          rpcClient["cache.getMembersForParent"](args),
        getChannelsForResource: (args: RpcPayload<"cache.getChannelsForResource">) =>
          rpcClient["cache.getChannelsForResource"](args),
        getRolesForResource: (args: RpcPayload<"cache.getRolesForResource">) =>
          rpcClient["cache.getRolesForResource"](args),
        getMembersForResource: (args: RpcPayload<"cache.getMembersForResource">) =>
          rpcClient["cache.getMembersForResource"](args),
        getChannelsSize: () => rpcClient["cache.getChannelsSize"](undefined),
        getRolesSize: () => rpcClient["cache.getRolesSize"](undefined),
        getMembersSize: () => rpcClient["cache.getMembersSize"](undefined),
        getChannelsSizeForParent: (args: RpcPayload<"cache.getChannelsSizeForParent">) =>
          rpcClient["cache.getChannelsSizeForParent"](args),
        getRolesSizeForParent: (args: RpcPayload<"cache.getRolesSizeForParent">) =>
          rpcClient["cache.getRolesSizeForParent"](args),
        getMembersSizeForParent: (args: RpcPayload<"cache.getMembersSizeForParent">) =>
          rpcClient["cache.getMembersSizeForParent"](args),
        getChannelsSizeForResource: (args: RpcPayload<"cache.getChannelsSizeForResource">) =>
          rpcClient["cache.getChannelsSizeForResource"](args),
        getRolesSizeForResource: (args: RpcPayload<"cache.getRolesSizeForResource">) =>
          rpcClient["cache.getRolesSizeForResource"](args),
        getMembersSizeForResource: (args: RpcPayload<"cache.getMembersSizeForResource">) =>
          rpcClient["cache.getMembersSizeForResource"](args),
      },
    };
  }),
}) {
  static layer = Layer.effect(SheetBotClient, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
