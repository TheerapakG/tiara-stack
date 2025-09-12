import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";
import { DBSubscriptionContext } from "typhoon-server/db";
import { HandlerGroup, Server } from "typhoon-server/server";
import { Config } from "../config";
import { DB } from "../db";
import { AuthService, CalcService, GuildConfigService } from "../services";
import {
  calcHandlerConfigGroup,
  calcHandlerGroup,
  guildConfigHandlerConfigGroup,
  guildConfigHandlerGroup,
  testHandlerConfigGroup,
  testHandlerGroup,
} from "./handler";

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

export const serverHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.addGroup(calcHandlerConfigGroup),
  HandlerConfigGroup.addGroup(guildConfigHandlerConfigGroup),
  HandlerConfigGroup.addGroup(testHandlerConfigGroup),
);

export const serverHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.addGroup(calcHandlerGroup),
  HandlerGroup.addGroup(guildConfigHandlerGroup),
  HandlerGroup.addGroup(testHandlerGroup),
);

export const server = pipe(
  Server.create(layer),
  Effect.map(Server.addGroup(serverHandlerGroup)),
);
