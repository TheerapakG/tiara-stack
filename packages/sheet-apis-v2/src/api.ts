import { HttpApi, OpenApi } from "@effect/platform";
import { CalcApi } from "./handlers/calc";
import { HealthApi } from "./handlers/health";
import { GuildConfigApi } from "./handlers/guildConfig";
import { MessageCheckinApi } from "./handlers/messageCheckin";
import { MessageRoomOrderApi } from "./handlers/messageRoomOrder";
import { MessageSlotApi } from "./handlers/messageSlot";
import { SheetApi } from "./handlers/sheet";
import { MonitorApi } from "./handlers/monitor";
import { PlayerApi } from "./handlers/player";
import { ScreenshotApi } from "./handlers/screenshot";
import { ScheduleApi } from "./handlers/schedule";

export class Api extends HttpApi.make("api")
  .add(CalcApi)
  .add(HealthApi)
  .add(GuildConfigApi)
  .add(MessageCheckinApi)
  .add(MessageRoomOrderApi)
  .add(MessageSlotApi)
  .add(SheetApi)
  .add(MonitorApi)
  .add(PlayerApi)
  .add(ScreenshotApi)
  .add(ScheduleApi)
  .annotate(OpenApi.Title, "Sheet APIs V2") {}
