import { NodeFileSystem, NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { createServer } from "http";
import {
  Cache,
  ConfigProvider,
  Context,
  Duration,
  Effect,
  Exit,
  FileSystem,
  HashSet,
  Layer,
  Logger,
  Option,
} from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpBody,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi";
import { Api } from "sheet-ingress-api/api";
import { SheetAuthTokenAuthorization } from "sheet-ingress-api/middlewares/sheetAuthTokenAuthorization/tag";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import {
  createSheetAuthClient,
  getAccount,
  getKubernetesOAuthImplicitPermissions,
} from "sheet-auth/client";
import { config } from "./config";

type Upstream = "sheetApis" | "sheetBot";

const hopByHopResponseHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const skippedResponseHeaders = new Set([...hopByHopResponseHeaders, "content-length"]);

const makeTargetUrl = (baseUrl: string, requestUrl: string) => {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = requestUrl.replace(/^\/+/, "");
  const url = new URL(relativePath, base);

  return url.toString();
};

const responseHeadersFrom = (headers: Readonly<Record<string, string>>) => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!skippedResponseHeaders.has(key.toLowerCase())) {
      result[key] = value;
    }
  }

  return result;
};

const forwardedHeadersFrom = (request: HttpServerRequest.HttpServerRequest) => {
  const remoteAddress = Option.getOrUndefined(request.remoteAddress);
  const forwardedFor = remoteAddress
    ? [request.headers["x-forwarded-for"], remoteAddress].filter(Boolean).join(", ")
    : request.headers["x-forwarded-for"];

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    "x-forwarded-host": request.headers["x-forwarded-host"] ?? request.headers.host ?? "",
    "x-forwarded-proto": request.headers["x-forwarded-proto"] ?? "http",
  };
};

const getBearerAuthorization = (request: HttpServerRequest.HttpServerRequest) => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() === "" ? undefined : authorization;
};

type ServiceTokenAuthorizerService = {
  readonly hasServicePermission: (authorization: string) => Effect.Effect<boolean, unknown>;
};

class ServiceTokenAuthorizer extends Context.Service<
  ServiceTokenAuthorizer,
  ServiceTokenAuthorizerService
>()("ServiceTokenAuthorizer") {
  static layer = Layer.effect(
    ServiceTokenAuthorizer,
    Effect.gen(function* () {
      const sheetAuthIssuer = yield* config.sheetAuthIssuer;
      const authClient = createSheetAuthClient(sheetAuthIssuer.replace(/\/$/, ""));
      const servicePermissionCache = yield* Cache.makeWith(
        (authorization: string) =>
          Effect.gen(function* () {
            const authorizationHeaders = { Authorization: authorization };
            yield* getAccount(authClient, ["discord", "kubernetes:discord"], authorizationHeaders);
            const { permissions } = yield* getKubernetesOAuthImplicitPermissions(
              authClient,
              authorizationHeaders,
            );

            return permissions.some((permission) => permission === "service");
          }).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to authorize service token for bot proxy route", error),
            ),
          ),
        {
          capacity: 10_000,
          timeToLive: Exit.match({
            onFailure: () => Duration.seconds(1),
            onSuccess: () => Duration.seconds(30),
          }),
        },
      );

      return {
        hasServicePermission: (authorization: string) =>
          Cache.get(servicePermissionCache, authorization),
      };
    }),
  );
}

const proxyTo =
  (
    upstream: Upstream,
    baseUrl: string,
    options?: { readonly requireServicePermission?: boolean },
  ) =>
  ({ request }: { readonly request: HttpServerRequest.HttpServerRequest }) =>
    Effect.gen(function* () {
      if (options?.requireServicePermission) {
        const authorization = getBearerAuthorization(request);
        if (!authorization) {
          return HttpServerResponse.text("Unauthorized", { status: 401 });
        }

        const serviceTokenAuthorizer = yield* ServiceTokenAuthorizer;
        const hasServicePermission = yield* serviceTokenAuthorizer
          .hasServicePermission(authorization)
          .pipe(Effect.catch(() => Effect.succeed(false)));

        if (!hasServicePermission) {
          return HttpServerResponse.text("Unauthorized", { status: 401 });
        }
      }

      const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
        Effect.mapError((cause) => new Error("Incoming request conversion failed", { cause })),
      );
      const targetUrl = makeTargetUrl(baseUrl, request.url);
      const client = yield* HttpClient.HttpClient;
      const response = yield* client
        .execute(
          HttpClientRequest.fromWeb(webRequest).pipe(
            HttpClientRequest.setUrl(targetUrl),
            HttpClientRequest.setHeaders(forwardedHeadersFrom(request)),
          ),
        )
        .pipe(Effect.timeout(Duration.seconds(30)));

      const contentType = response.headers["content-type"] ?? "application/octet-stream";
      const body = HttpBody.stream(response.stream, contentType);

      return HttpServerResponse.raw(body, {
        status: response.status,
        headers: responseHeadersFrom(response.headers),
      });
    }).pipe(
      Effect.catch((error) =>
        Effect.logError(`Ingress proxy failed for ${upstream}`, error).pipe(
          Effect.as(HttpServerResponse.text("Bad Gateway", { status: 502 })),
        ),
      ),
    );

const SheetAuthTokenAuthorizationPassthrough = Layer.succeed(
  SheetAuthTokenAuthorization,
  SheetAuthTokenAuthorization.of({
    // Ingress only preserves the bearer token shape for proxied sheet-apis routes.
    // The upstream service performs real token validation; do not use this synthetic
    // user for ingress-local authorization decisions.
    sheetAuthToken: (httpEffect, { credential }) =>
      Effect.provideService(httpEffect, SheetAuthUser, {
        accountId: "ingress-proxy",
        userId: "ingress-proxy",
        permissions: HashSet.empty(),
        token: credential,
      }),
  }),
);

const makeApiLayer = ({
  sheetApisBaseUrl,
  sheetBotBaseUrl,
}: {
  readonly sheetApisBaseUrl: string;
  readonly sheetBotBaseUrl: string;
}) => {
  const sheetApisProxy = proxyTo("sheetApis", sheetApisBaseUrl);
  const sheetBotProxy = proxyTo("sheetBot", sheetBotBaseUrl, { requireServicePermission: true });

  const ProxyLayers = Layer.mergeAll(
    HttpApiBuilder.group(Api, "calc", (handlers) =>
      handlers.handleRaw("calcBot", sheetApisProxy).handleRaw("calcSheet", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "checkin", (handlers) =>
      handlers.handleRaw("generate", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "discord", (handlers) =>
      handlers
        .handleRaw("getCurrentUser", sheetApisProxy)
        .handleRaw("getCurrentUserGuilds", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "guildConfig", (handlers) =>
      handlers
        .handleRaw("getAutoCheckinGuilds", sheetApisProxy)
        .handleRaw("getGuildConfig", sheetApisProxy)
        .handleRaw("upsertGuildConfig", sheetApisProxy)
        .handleRaw("getGuildMonitorRoles", sheetApisProxy)
        .handleRaw("getGuildChannels", sheetApisProxy)
        .handleRaw("addGuildMonitorRole", sheetApisProxy)
        .handleRaw("removeGuildMonitorRole", sheetApisProxy)
        .handleRaw("upsertGuildChannelConfig", sheetApisProxy)
        .handleRaw("getGuildChannelById", sheetApisProxy)
        .handleRaw("getGuildChannelByName", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "health", (handlers) =>
      handlers.handleRaw("live", sheetApisProxy).handleRaw("ready", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "messageCheckin", (handlers) =>
      handlers
        .handleRaw("getMessageCheckinData", sheetApisProxy)
        .handleRaw("upsertMessageCheckinData", sheetApisProxy)
        .handleRaw("getMessageCheckinMembers", sheetApisProxy)
        .handleRaw("addMessageCheckinMembers", sheetApisProxy)
        .handleRaw("setMessageCheckinMemberCheckinAt", sheetApisProxy)
        .handleRaw("removeMessageCheckinMember", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "messageRoomOrder", (handlers) =>
      handlers
        .handleRaw("getMessageRoomOrder", sheetApisProxy)
        .handleRaw("upsertMessageRoomOrder", sheetApisProxy)
        .handleRaw("persistMessageRoomOrder", sheetApisProxy)
        .handleRaw("decrementMessageRoomOrderRank", sheetApisProxy)
        .handleRaw("incrementMessageRoomOrderRank", sheetApisProxy)
        .handleRaw("getMessageRoomOrderEntry", sheetApisProxy)
        .handleRaw("getMessageRoomOrderRange", sheetApisProxy)
        .handleRaw("upsertMessageRoomOrderEntry", sheetApisProxy)
        .handleRaw("removeMessageRoomOrderEntry", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "messageSlot", (handlers) =>
      handlers
        .handleRaw("getMessageSlotData", sheetApisProxy)
        .handleRaw("upsertMessageSlotData", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "monitor", (handlers) =>
      handlers
        .handleRaw("getMonitorMaps", sheetApisProxy)
        .handleRaw("getByIds", sheetApisProxy)
        .handleRaw("getByNames", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "permissions", (handlers) =>
      handlers.handleRaw("getCurrentUserPermissions", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "player", (handlers) =>
      handlers
        .handleRaw("getPlayerMaps", sheetApisProxy)
        .handleRaw("getByIds", sheetApisProxy)
        .handleRaw("getByNames", sheetApisProxy)
        .handleRaw("getTeamsByIds", sheetApisProxy)
        .handleRaw("getTeamsByNames", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "roomOrder", (handlers) =>
      handlers.handleRaw("generate", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "schedule", (handlers) =>
      handlers
        .handleRaw("getAllPopulatedSchedules", sheetApisProxy)
        .handleRaw("getDayPopulatedSchedules", sheetApisProxy)
        .handleRaw("getChannelPopulatedSchedules", sheetApisProxy)
        .handleRaw("getDayPlayerSchedule", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "screenshot", (handlers) =>
      handlers.handleRaw("getScreenshot", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "sheet", (handlers) =>
      handlers
        .handleRaw("getPlayers", sheetApisProxy)
        .handleRaw("getMonitors", sheetApisProxy)
        .handleRaw("getTeams", sheetApisProxy)
        .handleRaw("getAllSchedules", sheetApisProxy)
        .handleRaw("getDaySchedules", sheetApisProxy)
        .handleRaw("getChannelSchedules", sheetApisProxy)
        .handleRaw("getRangesConfig", sheetApisProxy)
        .handleRaw("getTeamConfig", sheetApisProxy)
        .handleRaw("getEventConfig", sheetApisProxy)
        .handleRaw("getScheduleConfig", sheetApisProxy)
        .handleRaw("getRunnerConfig", sheetApisProxy),
    ),
    HttpApiBuilder.group(Api, "application", (handlers) =>
      handlers.handleRaw("getApplication", sheetBotProxy),
    ),
    HttpApiBuilder.group(Api, "cache", (handlers) =>
      handlers
        .handleRaw("getGuild", sheetBotProxy)
        .handleRaw("getGuildSize", sheetBotProxy)
        .handleRaw("getChannel", sheetBotProxy)
        .handleRaw("getRole", sheetBotProxy)
        .handleRaw("getMember", sheetBotProxy)
        .handleRaw("getChannelsForParent", sheetBotProxy)
        .handleRaw("getRolesForParent", sheetBotProxy)
        .handleRaw("getMembersForParent", sheetBotProxy)
        .handleRaw("getChannelsForResource", sheetBotProxy)
        .handleRaw("getRolesForResource", sheetBotProxy)
        .handleRaw("getMembersForResource", sheetBotProxy)
        .handleRaw("getChannelsSize", sheetBotProxy)
        .handleRaw("getRolesSize", sheetBotProxy)
        .handleRaw("getMembersSize", sheetBotProxy)
        .handleRaw("getChannelsSizeForParent", sheetBotProxy)
        .handleRaw("getRolesSizeForParent", sheetBotProxy)
        .handleRaw("getMembersSizeForParent", sheetBotProxy)
        .handleRaw("getChannelsSizeForResource", sheetBotProxy)
        .handleRaw("getRolesSizeForResource", sheetBotProxy)
        .handleRaw("getMembersSizeForResource", sheetBotProxy),
    ),
  );

  return HttpApiBuilder.layer(Api).pipe(
    Layer.provide(ProxyLayers.pipe(Layer.provide(SheetAuthTokenAuthorizationPassthrough))),
    Layer.merge(HttpApiSwagger.layer(Api)),
    Layer.merge(HttpRouter.add("GET", "/health", HttpServerResponse.empty({ status: 200 }))),
  );
};

const configProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(".env").pipe(
      Effect.map((content) =>
        ConfigProvider.layerAdd(ConfigProvider.fromDotEnvContents(content)).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
        ),
      ),
      Effect.catch((error) =>
        Effect.logWarning(
          "Could not read .env file, falling back to environment variables",
          error,
        ).pipe(Effect.as(ConfigProvider.layer(ConfigProvider.fromEnv()))),
      ),
    );
  }),
).pipe(Layer.provide(NodeFileSystem.layer));

const HttpLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* config.port;
    const sheetApisBaseUrl = yield* config.sheetApisBaseUrl;
    const sheetBotBaseUrl = yield* config.sheetBotBaseUrl;
    const ApiLayer = makeApiLayer({ sheetApisBaseUrl, sheetBotBaseUrl });

    return HttpRouter.serve(ApiLayer).pipe(
      HttpServer.withLogAddress,
      Layer.provide(ServiceTokenAuthorizer.layer),
      Layer.provide(NodeHttpServer.layer(createServer, { port })),
    );
  }),
);

HttpLive.pipe(
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(NodeHttpClient.layerFetch),
  Layer.provide(configProviderLayer),
  Layer.launch,
  NodeRuntime.runMain,
);
