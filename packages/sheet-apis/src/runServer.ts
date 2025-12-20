import { NodeSdk } from "@effect/opentelemetry";
import { FetchHttpClient } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { serve as crosswsServe } from "crossws/server/node";
import { Effect, Layer, Logger, pipe } from "effect";
import { Context } from "typhoon-server/handler";
import { DB } from "typhoon-server/db";
import { Server } from "typhoon-server/server";
import { SignalService } from "typhoon-core/signal";
import { Config } from "./config";
import { DBService, ZeroServiceLayer } from "./db";
import {
  calcHandlerCollection,
  guildConfigHandlerCollection,
  sheetHandlerCollection,
  playerHandlerCollection,
  messageCheckinHandlerCollection,
  messageRoomOrderHandlerCollection,
  messageSlotHandlerCollection,
  screenshotHandlerCollection,
} from "./server/handler/handler";
import {
  AuthService,
  CalcService,
  GuildConfigService,
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
  SheetConfigService,
} from "./server/services";
import { GoogleLive } from "./google";

const TracesLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-apis" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

const MetricsLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-apis" },
  metricReader: new PrometheusExporter(),
}));

const baseLayer = Layer.mergeAll(MetricsLive, Logger.logFmt);

const layer = pipe(
  Layer.mergeAll(
    SignalService.layer,
    AuthService.DefaultWithoutDependencies,
    CalcService.Default,
    GuildConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
    MessageRoomOrderService.DefaultWithoutDependencies,
    MessageSlotService.DefaultWithoutDependencies,
    SheetConfigService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(
    Layer.mergeAll(DBService.DefaultWithoutDependencies, ZeroServiceLayer),
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      DB.DBSubscriptionContext.Default,
      GoogleLive,
      Config.Default,
      FetchHttpClient.layer,
      NodeContext.layer,
    ),
  ),
  Layer.provideMerge(baseLayer),
);

const serverHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addCollection(calcHandlerCollection),
  Context.Collection.addCollection(guildConfigHandlerCollection),
  Context.Collection.addCollection(sheetHandlerCollection),
  Context.Collection.addCollection(playerHandlerCollection),
  Context.Collection.addCollection(messageCheckinHandlerCollection),
  Context.Collection.addCollection(messageRoomOrderHandlerCollection),
  Context.Collection.addCollection(messageSlotHandlerCollection),
  Context.Collection.addCollection(screenshotHandlerCollection),
);

const server = pipe(
  Server.create(crosswsServe),
  Effect.map(Server.addCollection(serverHandlerCollection)),
  Effect.map(Server.withTraceProvider(TracesLive)),
);

const serveEffect = pipe(
  Effect.Do,
  Effect.bind("server", () => server),
  Effect.bind("runtime", () => Layer.toRuntime(layer)),
  Effect.flatMap(({ server, runtime }) => Server.start(server, runtime)),
  Effect.sandbox,
  Effect.catchAll((error) => Effect.logError(error)),
  Effect.provide(baseLayer),
  Effect.scoped,
);

NodeRuntime.runMain(serveEffect, {
  disableErrorReporting: true,
  disablePrettyLogger: true,
});
