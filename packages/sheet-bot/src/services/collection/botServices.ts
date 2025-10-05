import { SheetApisClient } from "@/client";
import { Config } from "@/config";
import { DBService } from "@/db";
import {
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
} from "@/services/bot";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { DB } from "typhoon-server/db";

export const botServices = pipe(
  Layer.mergeAll(
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
