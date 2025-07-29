import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Server } from "typhoon-server/server";
import { Config } from "../config";
import { DB } from "../db";
import { calcHandler } from "./handler";

const layer = pipe(
  DBSubscriptionContext.Default,
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(Config.Default),
);

export const server = pipe(
  Server.create(layer),
  Effect.map(Server.add(calcHandler)),
);
