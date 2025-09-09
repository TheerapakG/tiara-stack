import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Server } from "typhoon-server/server";
import { Config } from "../config";
import { DB } from "../db";
import { CalcService, GuildConfigService } from "../services";
import { botCalcHandler, calcHandler } from "./handler";

const layer = pipe(
  GuildConfigService.DefaultWithoutDependencies,
  Layer.provideMerge(DBSubscriptionContext.Default),
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(Layer.mergeAll(Config.Default, CalcService.Default)),
);

export const server = pipe(
  Server.create(layer),
  Effect.map(Server.add(botCalcHandler)),
  Effect.map(Server.add(calcHandler)),
);
