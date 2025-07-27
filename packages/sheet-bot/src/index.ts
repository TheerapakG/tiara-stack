import { NodeSdk } from "@effect/opentelemetry";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Layer, Logger, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Bot } from "./bot";
import { buttons } from "./buttons";
import { commands } from "./commands";
import { Config } from "./config";
import { DB } from "./db";
import { GoogleLive } from "./google";
import {
  ChannelConfigService,
  GuildConfigService,
  PermissionService,
  ScheduleService,
  SheetConfigService,
} from "./services";

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: "sheet-bot" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
  metricReader: new PrometheusExporter(),
}));

const layer = pipe(
  ScheduleService.Default,
  Layer.provideMerge(
    Layer.mergeAll(
      GuildConfigService.DefaultWithoutDependencies,
      ChannelConfigService.DefaultWithoutDependencies,
      SheetConfigService.DefaultWithoutDependencies,
    ),
  ),
  Layer.provideMerge(DBSubscriptionContext.Default),
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(GoogleLive),
  Layer.provideMerge(Config.Default),
  Layer.provideMerge(PermissionService.Default),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("bot", () =>
      pipe(
        Bot.create(layer),
        Effect.map(Bot.withTraceProvider(NodeSdkLive)),
        Effect.flatMap(Bot.registerProcessHandlers),
        Effect.flatMap(Bot.addChatInputCommandHandlerMap(commands)),
        Effect.flatMap(Bot.addButtonInteractionHandlerMap(buttons)),
      ),
    ),
    Effect.flatMap(({ bot }) => Bot.login(bot)),
    Effect.provide(layer),
    Effect.provide(Logger.logFmt),
  ),
);
