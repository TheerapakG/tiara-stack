import { NodeSdk } from "@effect/opentelemetry";
import { NodeRuntime } from "@effect/platform-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Layer, Logger, pipe } from "effect";
import { Bot } from "./bot";
import { commands } from "./commands";
import { Config } from "./config";
import { buttons } from "./messageComponents";
import { botServices } from "./services";
import { tasks } from "./tasks";

const TracesLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

const MetricsLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  metricReader: new PrometheusExporter(),
}));

const baseLayer = pipe(
  Config.Default,
  Layer.provideMerge(Layer.mergeAll(MetricsLive, Logger.logFmt)),
);

NodeRuntime.runMain(
  pipe(
    Effect.Do,
    Effect.bind("bot", () =>
      pipe(
        Bot.create(),
        Effect.map(Bot.withTraceProvider(TracesLive)),
        Effect.flatMap(Bot.addChatInputCommandHandlerMap(commands)),
        Effect.flatMap(Bot.addButtonInteractionHandlerMap(buttons)),
        Effect.flatMap(Bot.addTasks(tasks)),
      ),
    ),
    Effect.bind("runtime", () => Layer.toRuntime(botServices)),
    Effect.flatMap(({ bot, runtime }) => Bot.start(bot, runtime as any)),
    Effect.sandbox,
    Effect.catchAll((error) => Effect.logError(error)),
    Effect.provide(baseLayer),
    Effect.scoped,
  ),
  {
    disableErrorReporting: true,
    disablePrettyLogger: true,
  },
);
