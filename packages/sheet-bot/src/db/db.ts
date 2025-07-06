import { drizzle } from "drizzle-orm/postgres-js";
import { Effect } from "effect";
import { Config } from "../config";

export class DB extends Effect.Service<DB>()("DB", {
  effect: () =>
    Config.use(({ postgresUrl }) => Effect.try(() => drizzle(postgresUrl))),
  dependencies: [Config.Default()],
}) {}
