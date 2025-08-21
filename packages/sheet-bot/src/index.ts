import { NodeSdk } from "@effect/opentelemetry";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Logger, pipe } from "effect";
import { Bot } from "./bot";
import { commands } from "./commands";
import { Config } from "./config";
import { buttons } from "./messageComponents";
import { botServices } from "./services";

const TracesLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

const MetricsLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  metricReader: new PrometheusExporter(),
}));

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("bot", () =>
      pipe(
        Bot.create(botServices),
        Effect.map(Bot.withTraceProvider(TracesLive)),
        Effect.flatMap(Bot.registerProcessHandlers),
        Effect.flatMap(Bot.addChatInputCommandHandlerMap(commands)),
        Effect.flatMap(Bot.addButtonInteractionHandlerMap(buttons)),
      ),
    ),
    Effect.flatMap(({ bot }) => Bot.login(bot)),
    Effect.provide(Config.Default),
    Effect.provide(MetricsLive),
    Effect.provide(Logger.logFmt),
  ),
);
