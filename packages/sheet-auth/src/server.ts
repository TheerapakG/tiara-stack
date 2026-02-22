import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer,
  HttpServerRequest,
} from "@effect/platform";
import {
  NodeHttpClient,
  NodeHttpServer,
  NodeHttpServerRequest,
  NodeRuntime,
} from "@effect/platform-node";
import { Effect, Layer, Logger, Redacted } from "effect";
import { getRequestListener } from "@hono/node-server";
import { createServer } from "http";
import redisDriver from "unstorage/drivers/redis";
import { authConfig } from "./auth-config";
import { config } from "./config";
import { MetricsLive } from "./metrics";
import { TracesLive } from "./traces";

// Create Effect HTTP API with catch-all endpoints for Better Auth
const Api = HttpApi.make("sheet-auth").add(
  HttpApiGroup.make("auth")
    .add(HttpApiEndpoint.get("get", "/*"))
    .add(HttpApiEndpoint.post("post", "/*"))
    .add(HttpApiEndpoint.put("put", "/*"))
    .add(HttpApiEndpoint.del("delete", "/*"))
    .add(HttpApiEndpoint.patch("patch", "/*"))
    .add(HttpApiEndpoint.head("head", "/*"))
    .add(HttpApiEndpoint.options("options", "/*")),
);

// Handler type
type HandlerParams = {
  request: HttpServerRequest.HttpServerRequest;
};

// Build handlers that forward to Better Auth Hono handler
const AuthLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  Effect.gen(function* () {
    const discordClientId = yield* config.discordClientId;
    const discordClientSecret = yield* config.discordClientSecret;
    const postgresUrl = yield* config.postgresUrl;
    const kubernetesAudience = yield* config.kubernetesAudience;
    const baseUrl = yield* config.baseUrl;
    const redisUrl = yield* config.redisUrl;
    const redisBase = yield* config.redisBase;

    // Create Redis driver for secondary storage
    const redisStorageDriver = redisDriver({
      url: Redacted.value(redisUrl),
      base: redisBase,
    });

    // Create Better Auth instance
    const auth = authConfig({
      postgresUrl,
      discordClientId,
      discordClientSecret: Redacted.value(discordClientSecret),
      kubernetesAudience,
      baseUrl,
      secondaryStorageDriver: redisStorageDriver,
    });

    // Add cleanup finalizer for connections
    yield* Effect.addFinalizer(() =>
      Effect.all([
        Effect.promise(() => auth.close()),
        Effect.promise(() => auth.closeStorage()),
      ]).pipe(
        Effect.tapBoth({
          onFailure: (error) =>
            Effect.sync(() => console.error("Failed to close connections:", error)),
          onSuccess: () => Effect.sync(() => console.log("Connections closed")),
        }),
        Effect.orElse(() => Effect.void),
      ),
    );

    // Better Auth provides all routes including:
    // - /api/auth/* - Authentication (Discord OAuth, sessions, etc.)
    // - /oauth2/token - OAuth 2.0 token endpoint (from oauth-provider plugin + kubernetes-oauth plugin)
    // - /.well-known/jwks.json - JWKS for token verification
    // - /.well-known/oauth-authorization-server - OAuth 2.0 discovery
    // - /.well-known/openid-configuration - OpenID Connect discovery

    const listener = getRequestListener(auth.handler);

    const forwardRequest = ({ request }: HandlerParams) =>
      Effect.promise(() =>
        listener(
          NodeHttpServerRequest.toIncomingMessage(request),
          NodeHttpServerRequest.toServerResponse(request),
        ),
      );

    return handlers
      .handle("get", forwardRequest)
      .handle("post", forwardRequest)
      .handle("put", forwardRequest)
      .handle("delete", forwardRequest)
      .handle("patch", forwardRequest)
      .handle("head", forwardRequest)
      .handle("options", forwardRequest);
  }),
);

const ApiLive = Layer.provide(HttpApiBuilder.api(Api), AuthLive);

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  Layer.provide(NodeHttpClient.layer),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);

HttpLive.pipe(
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.logFmt),
  Layer.launch,
  NodeRuntime.runMain({
    disablePrettyLogger: true,
  }),
);
