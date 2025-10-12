import { SheetApisClient } from "@/client";
import {
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
} from "@/services/bot";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";

export const botServices = pipe(
  Layer.mergeAll(
    MessageCheckinService.DefaultWithoutDependencies,
    MessageRoomOrderService.DefaultWithoutDependencies,
    MessageSlotService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(SheetApisClient.DefaultWithoutDependencies),
  Layer.provideMerge(NodeContext.layer),
  Effect.succeed,
  Effect.withSpan("botServices", {
    captureStackTrace: true,
  }),
  Layer.unwrapEffect,
);
