import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Config } from "../../config";
import { DB } from "../../db";
import { GoogleLive } from "../../google";
import {
  ChannelConfigService,
  MessageCheckinService,
  SheetConfigService,
} from "../bot";

export const botServices = pipe(
  Layer.mergeAll(
    ChannelConfigService.DefaultWithoutDependencies,
    SheetConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(
    Layer.mergeAll(DBSubscriptionContext.Default, GoogleLive, Config.Default),
  ),
  Effect.succeed,
  Effect.withSpan("botServices", {
    captureStackTrace: true,
  }),
  Layer.unwrapEffect,
);
