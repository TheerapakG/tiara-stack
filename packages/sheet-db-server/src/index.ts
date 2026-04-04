import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Layer, Logger } from "effect";
import { HttpLive } from "./http";
import { MetricsLive } from "./metrics";
import { TracesLive } from "./traces";

const configProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const haveDotEnv = yield* fs.exists(".env");
    if (haveDotEnv) {
      return ConfigProvider.layerAdd(ConfigProvider.fromDotEnv({ path: ".env" })).pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
      );
    }
    return ConfigProvider.layer(ConfigProvider.fromEnv());
  }),
).pipe(Layer.provide(NodeFileSystem.layer));

HttpLive.pipe(
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(configProviderLayer),
  Layer.launch,
  NodeRuntime.runMain(),
);
