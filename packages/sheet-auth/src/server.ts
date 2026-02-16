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
import { createAuthIssuer } from "./issuer";
import { config } from "./config";
import { MetricsLive } from "./metrics";
import { TracesLive } from "./traces";

// Create Effect HTTP API with catch-all endpoints
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

// Build handlers that forward to Hono
const AuthLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  Effect.gen(function* () {
    const discordClientId = yield* config.discordClientId;
    const discordClientSecret = yield* config.discordClientSecret;
    const redisUrl = yield* config.redisUrl;
    const kubernetesAudience = yield* config.kubernetesAudience;
    const kubernetesApiServerUrl = yield* config.kubernetesApiServerUrl;

    const honoApp = createAuthIssuer({
      discordClientId,
      discordClientSecret: Redacted.value(discordClientSecret),
      redisUrl,
      kubernetesAudience,
      kubernetesApiServerUrl,
    });
    const listener = getRequestListener(honoApp.fetch);

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
