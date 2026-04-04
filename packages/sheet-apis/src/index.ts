import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { httpLayer } from "./http";
import { MetricsLive } from "./metrics";
import { GuildConfigService } from "./services/guildConfig";
import { TracesLive } from "./traces";

const main = httpLayer.pipe(
  Layer.provide(GuildConfigService.layer),
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(
    ConfigProvider.layerAdd(ConfigProvider.fromDotEnv()).pipe(Layer.provide(NodeFileSystem.layer)),
  ),
  Layer.launch,
);

NodeRuntime.runMain(main as Effect.Effect<never, unknown>);
