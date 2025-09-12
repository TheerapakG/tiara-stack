import { NodeSdk } from "@effect/opentelemetry";
import { NodeRuntime } from "@effect/platform-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { serve as crosswsServe } from "crossws/server/node";
import { Effect, Logger, pipe } from "effect";
import {
  InferServerType,
  serve,
  Server as TyphoonServer,
} from "typhoon-server/server";
import { server } from "./server";
export { serverHandlerConfigGroup } from "./server";
export * from "./services";

export type Server = InferServerType<typeof server>;

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
  Effect.map(TyphoonServer.withTraceProvider(TracesLive)),
  Effect.flatMap(serve(crosswsServe)),
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
