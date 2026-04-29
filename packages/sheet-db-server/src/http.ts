import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi";
import { HttpServer, HttpRouter } from "effect/unstable/http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createServer } from "http";
import { makeZeroHttpLive } from "typhoon-zero/server";
import { mutators, queries, schema } from "sheet-db-schema/zero";
import { Api } from "./api";
import { DBService } from "./services/db";

const ZeroHttpLive = makeZeroHttpLive(Api, {
  schema,
  queries,
  mutators,
  zql: Effect.gen(function* () {
    const dbService = yield* DBService;
    return dbService.zql;
  }),
}).pipe(Layer.provide(DBService.layer));

const ApiLayer = Layer.provide(HttpApiBuilder.layer(Api), [ZeroHttpLive]).pipe(
  Layer.merge(HttpApiSwagger.layer(Api)),
  Layer.provide(HttpRouter.cors()),
);

export const HttpLive = HttpRouter.serve(ApiLayer).pipe(
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);
