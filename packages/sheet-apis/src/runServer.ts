import { NodeSdk } from "@effect/opentelemetry";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { serve as crosswsServe } from "crossws/server/node";
import { Effect, Layer, Logger, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { HandlerGroup, Server } from "typhoon-server/server";
import { Config } from "./config";
import { DB } from "./db";
import {
  calcHandlerGroup,
  guildConfigHandlerGroup,
  testHandlerGroup,
} from "./server/handler/handler";
import {
  AuthService,
  CalcService,
  GuildConfigService,
} from "./server/services";

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

const serverHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.addGroup(calcHandlerGroup),
  HandlerGroup.addGroup(guildConfigHandlerGroup),
  HandlerGroup.addGroup(testHandlerGroup),
);

const server = pipe(
  Server.create(layer),
  Effect.map(Server.addGroup(serverHandlerGroup)),
);

const TracesLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-apis" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

const MetricsLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-apis" },
  metricReader: new PrometheusExporter(),
}));

const serveEffect = pipe(
  server,
  Effect.map(Server.withTraceProvider(TracesLive)),
  Effect.flatMap(Server.serve(crosswsServe)),
  Effect.flatMap((latch) => latch.await),
  Effect.sandbox,
  Effect.catchAll((error) => Effect.logError(error)),
  Effect.provide(MetricsLive),
  Effect.provide(Logger.logFmt),
);

NodeRuntime.runMain(serveEffect, {
  disableErrorReporting: true,
  disablePrettyLogger: true,
});
