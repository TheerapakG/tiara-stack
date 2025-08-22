import { drizzle } from "drizzle-orm/postgres-js";
import { Effect, pipe } from "effect";
import postgres from "postgres";
import { Config } from "@/config";

export class DB extends Effect.Service<DB>()("DB", {
  scoped: pipe(
    Effect.Do,
    Effect.tap(() => Effect.log("creating db client")),
    Effect.bind("client", () =>
      Config.use(({ postgresUrl }) => Effect.try(() => postgres(postgresUrl))),
    ),
    Effect.bind("db", ({ client }) => Effect.try(() => drizzle(client))),
    Effect.tap(({ client }) =>
      Effect.addFinalizer(() =>
        pipe(
          Effect.promise(() => client.end()),
          Effect.andThen(() => Effect.log("DB client closed")),
        ),
      ),
    ),
    Effect.map(({ db }) => db),
  ),
  dependencies: [Config.Default],
}) {}
