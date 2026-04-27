import { NodeSdk } from "@effect/opentelemetry";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export const TelemetryLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-ingress-server" },
  metricReader: new PrometheusExporter(),
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));
