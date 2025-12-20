import { SheetApisClient } from "@/client";
import {
  BotGuildConfigService,
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
} from "@/services/bot";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, pipe } from "effect";
import { SignalService } from "typhoon-core/signal";

export const botServices = pipe(
  Layer.mergeAll(
    BotGuildConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
    MessageRoomOrderService.DefaultWithoutDependencies,
    MessageSlotService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(SheetApisClient.DefaultWithoutDependencies),
  Layer.provideMerge(Layer.mergeAll(NodeContext.layer, SignalService.layer)),
  Effect.succeed,
  Effect.withSpan("botServices", {
    captureStackTrace: true,
  }),
  Layer.unwrapEffect,
);
