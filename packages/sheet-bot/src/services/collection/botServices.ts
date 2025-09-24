import { SheetApisClient } from "@/client";
import { Config } from "@/config";
import { DBService } from "@/db";
import { GoogleLive } from "@/google";
import {
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
  SheetConfigService,
} from "@/services/bot";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { DB } from "typhoon-server/db";

export const botServices = pipe(
  Layer.mergeAll(
    SheetConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
    MessageRoomOrderService.DefaultWithoutDependencies,
    MessageSlotService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      DBService.DefaultWithoutDependencies,
      SheetApisClient.DefaultWithoutDependencies,
    ),
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      DB.DBSubscriptionContext.Default,
      GoogleLive,
      Config.Default,
      NodeContext.layer,
    ),
  ),
  Effect.succeed,
  Effect.withSpan("botServices", {
    captureStackTrace: true,
  }),
  Layer.unwrapEffect,
);
