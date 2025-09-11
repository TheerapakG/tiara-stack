import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Server } from "typhoon-server/server";
import { Config } from "../config";
import { DB } from "../db";
import { AuthService, CalcService, GuildConfigService } from "../services";
import { calcHandlerGroup, testHandlerGroup } from "./handler";

const layer = pipe(
  Layer.mergeAll(
    GuildConfigService.DefaultWithoutDependencies,
    CalcService.Default,
    AuthService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(
    Layer.mergeAll(
      Config.Default,
      DBSubscriptionContext.Default,
      NodeContext.layer,
    ),
  ),
);

export const server = pipe(
  Server.create(layer),
  Effect.map(Server.addGroup(calcHandlerGroup)),
  Effect.map(Server.addGroup(testHandlerGroup)),
);
