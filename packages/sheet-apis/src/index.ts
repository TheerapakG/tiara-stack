import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Layer, Logger } from "effect";
import { httpLayer } from "./http";
import { MetricsLive } from "./metrics";
import { GuildConfigService } from "./services/guildConfig";
import { TracesLive } from "./traces";

const configProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(".env").pipe(
      Effect.map((content) =>
        ConfigProvider.layerAdd(ConfigProvider.fromDotEnvContents(content)).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
        ),
      ),
      Effect.catch(() => Effect.succeed(ConfigProvider.layer(ConfigProvider.fromEnv()))),
    );
  }),
).pipe(Layer.provide(NodeFileSystem.layer));

const main = httpLayer.pipe(
  Layer.provide(GuildConfigService.layer),
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(configProviderLayer),
  Layer.launch,
);

NodeRuntime.runMain(main as Effect.Effect<never, unknown>);
