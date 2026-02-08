import { PlatformConfigProvider } from "@effect/platform";
import { NodeRuntime, NodeContext, NodeHttpClient } from "@effect/platform-node";
import { Layer, pipe } from "effect";
import { ChannelCommandLive } from "./commands/channel";
import { KickoutCommandLive } from "./commands/kickout";
import { ScreenshotCommandLive } from "./commands/screenshot";
import { ScheduleCommandLive } from "./commands/schedule";
import { TeamCommandLive } from "./commands/team";
import { CheckinButtonLive } from "./messageComponents/buttons/checkin";
import { RoomOrderButtonLive } from "./messageComponents/buttons/roomOrder";
import { SlotButtonLive } from "./messageComponents/buttons/slot";
import { AutoCheckinTaskLive } from "./tasks";

const MainLive = pipe(
  Layer.mergeAll(
    ChannelCommandLive,
    KickoutCommandLive,
    ScreenshotCommandLive,
    ScheduleCommandLive,
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
