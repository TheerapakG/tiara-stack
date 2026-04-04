import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi";
import { HttpServer, HttpRouter } from "effect/unstable/http";
import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { createServer } from "http";
import { Api } from "./api";
import { ZeroHttpLive } from "./handlers/zero/http";

const ApiLayer = Layer.provide(HttpApiBuilder.layer(Api), [ZeroHttpLive]).pipe(
  Layer.merge(HttpApiSwagger.layer(Api)),
  Layer.provide(HttpRouter.cors()),
);

export const HttpLive = HttpRouter.serve(ApiLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
