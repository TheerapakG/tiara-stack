import { PlatformConfigProvider } from "@effect/platform";
import { NodeRuntime, NodeContext, NodeHttpClient } from "@effect/platform-node";
import { UnstorageLayer } from "./discord/cache";
import { DiscordConfigLayer } from "./discord/config";
import { Layer, Logger } from "effect";
import { MetricsLive } from "./metrics";
import { TracesLive } from "./traces";
import { ChannelCommandLive } from "./commands/channel";
import { CheckinCommandLive } from "./commands/checkin";
import { KickoutCommandLive } from "./commands/kickout";
import { RoomOrderCommandLive } from "./commands/roomOrder";
import { ScreenshotCommandLive } from "./commands/screenshot";
import { ScheduleCommandLive } from "./commands/schedule";
import { ServerCommandLive } from "./commands/server";
import { SlotCommandLive } from "./commands/slot";
import { TeamCommandLive } from "./commands/team";
import { CheckinButtonLive } from "./messageComponents/buttons/checkin";
import { RoomOrderButtonLive } from "./messageComponents/buttons/roomOrder";
import { SlotButtonLive } from "./messageComponents/buttons/slot";
import { AutoCheckinTaskLive } from "./tasks";
import { HttpLive } from "./http";

const BotLive = Layer.mergeAll(
  ChannelCommandLive,
  CheckinCommandLive,
  KickoutCommandLive,
  RoomOrderCommandLive,
  ScreenshotCommandLive,
  ScheduleCommandLive,
  ServerCommandLive,
  SlotCommandLive,
  TeamCommandLive,
  CheckinButtonLive,
  RoomOrderButtonLive,
  SlotButtonLive,
  AutoCheckinTaskLive,
);

const RuntimeDependencies = Layer.mergeAll(DiscordConfigLayer, UnstorageLayer);

// Combined layer for both bot and HTTP server
// They share the same Unstorage layer for cache access
const SharedLive = Layer.mergeAll(BotLive, HttpLive).pipe(
  Layer.provide(RuntimeDependencies),
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.logFmt),
  Layer.provide(PlatformConfigProvider.layerDotEnvAdd(".env")),
  Layer.provide(NodeContext.layer),
  Layer.provide(NodeHttpClient.layer),
);

SharedLive.pipe(
  Layer.launch,
  NodeRuntime.runMain({
    disablePrettyLogger: true,
  }),
);
