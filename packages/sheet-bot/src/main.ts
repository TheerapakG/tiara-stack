import { NodeFileSystem, NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { ConfigProvider, Effect, FileSystem, Layer, Logger } from "effect";
import { channelCommandLayer } from "./commands/channel";
import { checkinCommandLayer } from "./commands/checkin";
import { kickoutCommandLayer } from "./commands/kickout";
import { roomOrderCommandLayer } from "./commands/roomOrder";
import { scheduleCommandLayer } from "./commands/schedule";
import { screenshotCommandLayer } from "./commands/screenshot";
import { serverCommandLayer } from "./commands/server";
import { slotCommandLayer } from "./commands/slot";
import { teamCommandLayer } from "./commands/team";
import { httpLayer } from "./http";
import { checkinButtonLayer } from "./messageComponents/buttons/checkin";
import { roomOrderButtonLayer } from "./messageComponents/buttons/roomOrder";
import { slotButtonLayer } from "./messageComponents/buttons/slot";
import { MetricsLive } from "./metrics";
import { autoCheckinTaskLayer } from "./tasks";
import { TracesLive } from "./traces";

const botLayer = Layer.mergeAll(
  channelCommandLayer,
  checkinCommandLayer,
  kickoutCommandLayer,
  roomOrderCommandLayer,
  screenshotCommandLayer,
  scheduleCommandLayer,
  serverCommandLayer,
  slotCommandLayer,
  teamCommandLayer,
  checkinButtonLayer,
  roomOrderButtonLayer,
  slotButtonLayer,
  autoCheckinTaskLayer,
);

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

const main = Layer.mergeAll(botLayer, httpLayer).pipe(
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(NodeHttpClient.layerFetch),
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(configProviderLayer),
  Layer.launch,
);

NodeRuntime.runMain(main as Effect.Effect<never, unknown>);
