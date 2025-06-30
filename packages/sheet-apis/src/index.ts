import { NodeSdk } from "@effect/opentelemetry";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { serve as crosswsServe } from "crossws/server/node";
import { Effect, pipe } from "effect";
import {
  InferServerType,
  serve,
  Server as TyphoonServer,
} from "typhoon-server/server";
import { server } from "./server";

export type Server = InferServerType<typeof server>;

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-apis" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
  metricReader: new PrometheusExporter(),
}));

const serveEffect = pipe(
  server,
  Effect.map(TyphoonServer.withTraceProvider(NodeSdkLive)),
  Effect.flatMap(serve(crosswsServe)),
);

Effect.runPromise(serveEffect);
