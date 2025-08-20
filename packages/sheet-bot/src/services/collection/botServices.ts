import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { SheetApisClient } from "../../client";
import { Config } from "../../config";
import { DB } from "../../db";
import { GoogleLive } from "../../google";
import {
  ChannelConfigService,
  MessageCheckinService,
  MessageRoomOrderService,
  SheetConfigService,
} from "../bot";

export const botServices = pipe(
  Layer.mergeAll(
    ChannelConfigService.DefaultWithoutDependencies,
    SheetConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
    MessageRoomOrderService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      DB.DefaultWithoutDependencies,
      SheetApisClient.DefaultWithoutDependencies,
    ),
  ),
  Layer.provideMerge(
    Layer.mergeAll(DBSubscriptionContext.Default, GoogleLive, Config.Default),
  ),
  Effect.succeed,
  Effect.withSpan("botServices", {
    captureStackTrace: true,
  }),
  Layer.unwrapEffect,
);
