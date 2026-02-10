import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export const TracesLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));
