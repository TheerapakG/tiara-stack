import { PlatformConfigProvider } from "@effect/platform";
import { NodeRuntime, NodeContext, NodeHttpClient } from "@effect/platform-node";
import { Layer, pipe } from "effect";
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

const MainLive = pipe(
  Layer.mergeAll(
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
  ),
  Layer.provide(PlatformConfigProvider.layerDotEnvAdd(".env")),
  Layer.provide(NodeContext.layer),
  Layer.provide(NodeHttpClient.layer),
);

const MainEffect = pipe(Layer.launch(MainLive));

NodeRuntime.runMain(MainEffect, {
  disablePrettyLogger: true,
});
