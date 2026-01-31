import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import { Effect, pipe } from "effect";
import postgres from "postgres";
import * as schema from "sheet-db-schema";
import { schema as zeroSchema } from "sheet-db-schema/zero";
import { Config } from "@/config";

export class DBService extends Effect.Service<DBService>()("DBService", {
  scoped: pipe(
    Effect.Do,
    Effect.tap(() => Effect.log("creating db client")),
    Effect.bind("client", () =>
      Config.use(({ postgresUrl }) => Effect.try(() => postgres(postgresUrl))),
    ),
    Effect.bind("db", ({ client }) => Effect.try(() => drizzle(client, { schema }))),
    Effect.bind("zql", ({ db }) => Effect.try(() => zeroDrizzle(zeroSchema, db))),
    Effect.tap(({ client }) =>
      Effect.addFinalizer(() =>
        pipe(
          Effect.promise(() => client.end()),
          Effect.andThen(() => Effect.log("DB client closed")),
        ),
      ),
    ),
    Effect.map(({ db, zql }) => ({ db, zql })),
  ),
  dependencies: [Config.Default],
}) {}
